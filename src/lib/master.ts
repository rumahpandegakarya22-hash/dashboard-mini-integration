import { redis, nsKey } from './redis';
import { readRange, readTable, readTableWithRowNum, updateRange } from './sheets';
import { SHEETS } from '@/config/spreadsheets';
import { normalizeRoomId } from './validate';

const TTL_SEC = 300; // 5 menit, sesuai PRD §8.4

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cacheKey = nsKey(`master:${key}`);
  const hit = await redis.get<T>(cacheKey);
  if (hit !== null && hit !== undefined) return hit;
  const val = await fn();
  await redis.set(cacheKey, val, { ex: TTL_SEC });
  return val;
}

/** Cari nama kolom aktual di header yang cocok salah satu kandidat (case-insensitive, partial match). */
function findHeader(headers: string[], label: string, ...candidates: string[]): string {
  const found = findHeaderOptional(headers, ...candidates);
  if (found) return found;
  throw new Error(
    `Kolom "${label}" tidak ditemukan. Header sheet aktual: ${headers.join(', ') || '(kosong)'}. Struktur sheet mungkin berubah — hubungi pengawas.`
  );
}

/** Sama seperti findHeader, tapi kembalikan undefined (bukan throw) jika kolom opsional tidak ada. */
function findHeaderOptional(headers: string[], ...candidates: string[]): string | undefined {
  for (const c of candidates) {
    const found = headers.find((h) => h.toLowerCase().includes(c.toLowerCase()));
    if (found) return found;
  }
  return undefined;
}

function parseNum(v: string | undefined): number {
  const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export interface Room {
  id: string;
  tipe: string;
  hargaBulan: number;
  harga3: number;
  harga6: number;
  harga9: number;
  hargaTahun: number;
  status: string;
  label: string; // untuk tampilan dropdown, mis. "5 — Tipe A · Rp850.000/bln" (id = nomor kamar polos, BUKAN "KTD-x")
}

async function fetchRoomsUncached(): Promise<Room[]> {
  const rows = await readTable(SHEETS.LOG_SALES, "'1.Daftar Kamar & Harga'!A:Z");
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const hId = findHeader(headers, 'No. Kamar', 'no. kamar', 'kamar');
  const hTipe = findHeader(headers, 'Tipe', 'tipe');
  const hB1 = findHeader(headers, 'Harga/Bulan', 'harga/bulan', 'harga bulan');
  const hB3 = findHeader(headers, 'Harga/3 Bln', '3 bln', '3 bulan');
  const hB6 = findHeader(headers, 'Harga/6 Bln', '6 bln', '6 bulan');
  const hB9 = findHeader(headers, 'Harga/9 Bln', '9 bln', '9 bulan');
  const hTahun = findHeader(headers, 'Harga/Tahun', 'tahun');
  const hStatus = findHeader(headers, 'Status', 'status');
  return rows
    .filter((r) => String(r[hId] ?? '').trim() !== '')
    .map((r) => {
      const id = normalizeRoomId(r[hId]);
      const tipe = r[hTipe] || '';
      const hargaBulan = parseNum(r[hB1]);
      return {
        id,
        tipe,
        hargaBulan,
        harga3: parseNum(r[hB3]),
        harga6: parseNum(r[hB6]),
        harga9: parseNum(r[hB9]),
        hargaTahun: parseNum(r[hTahun]),
        status: (r[hStatus] || '').trim(),
        label: `${id} — ${tipe} · Rp${hargaBulan.toLocaleString('id-ID')}/bln`
      };
    });
}

/** Master kamar dari Log Sales → "1.Daftar Kamar & Harga". */
export async function getRooms(): Promise<Room[]> {
  return cached('rooms', fetchRoomsUncached);
}

/** Kamar dengan status ≠ "Terisi" (dipakai Modul 1: hanya kamar kosong yang bisa dipilih). */
export async function getAvailableRooms(): Promise<Room[]> {
  const rooms = await getRooms();
  return rooms.filter((r) => r.status.toLowerCase() !== 'terisi');
}

/** Status kamar terkini TANPA cache — dipakai untuk re-check double-occupancy tepat sebelum tulis (PRD §10.2). */
export async function getRoomFresh(roomId: string): Promise<Room | undefined> {
  const rooms = await fetchRoomsUncached();
  return rooms.find((r) => r.id === roomId);
}

/** Update sel Status pada baris kamar terkait di Daftar Kamar & Harga (dipakai Modul 3 & 4). */
export async function updateRoomStatus(roomId: string, newStatus: string): Promise<void> {
  const rows = await readTableWithRowNum(SHEETS.LOG_SALES, "'1.Daftar Kamar & Harga'!A:Z");
  if (rows.length === 0) throw new Error('Sheet Daftar Kamar & Harga kosong.');
  const headers = Object.keys(rows[0].data);
  const hId = findHeader(headers, 'No. Kamar', 'no. kamar', 'kamar');
  const hStatus = findHeader(headers, 'Status', 'status');
  const target = rows.find((r) => {
    try {
      return normalizeRoomId(r.data[hId]) === roomId;
    } catch {
      return false;
    }
  });
  if (!target) throw new Error(`Kamar ${roomId} tidak ditemukan untuk update status.`);
  const colIdx = headers.indexOf(hStatus);
  const colLetter = String.fromCharCode(65 + colIdx);
  await updateRange(SHEETS.LOG_SALES, `'1.Daftar Kamar & Harga'!${colLetter}${target.row}`, [[newStatus]]);
  await redis.del(nsKey('master:rooms')); // cache 5 menit jadi stale kalau tidak dibersihkan setelah update status
}

export interface Account {
  kode: string;
  nama: string;
  tipe: string;
  saldoNormal: string;
  label: string; // untuk dropdown, mis. "5101 — Beban Listrik"
}

/**
 * Daftar Akun (125 akun) dari Log Input Transaksi. Kode & Saldo Normal OPSIONAL —
 * tabel yang dikonfirmasi user (8 Jul) cuma berisi Nama + Tipe, jadi jangan hard-fail
 * kalau kolom Kode ternyata tidak ada.
 */
export async function getAccounts(): Promise<Account[]> {
  return cached('accounts', async () => {
    const rows = await readTable(SHEETS.LOG_INPUT_TRANSAKSI, "'Daftar Akun'!A:Z");
    if (rows.length === 0) return [];
    const headers = Object.keys(rows[0]);
    const hKode = findHeaderOptional(headers, 'Kode', 'kode');
    const hNama = findHeader(headers, 'Nama', 'nama');
    const hTipe = findHeader(headers, 'Tipe', 'tipe');
    const hSaldo = findHeaderOptional(headers, 'Saldo Normal', 'saldo normal', 'saldo');
    return rows
      .filter((r) => String(r[hNama] ?? '').trim() !== '')
      .map((r) => {
        const kode = hKode ? r[hKode] || '' : '';
        const nama = r[hNama] || '';
        return { kode, nama, tipe: r[hTipe] || '', saldoNormal: hSaldo ? r[hSaldo] || '' : '', label: kode ? `${kode} — ${nama}` : nama };
      });
  });
}

export interface Tenant {
  id: string; // ID Penghuni Aktif, format "KTD-x" — BUKAN nomor kamar (dikoreksi user 8 Jul)
  kamar: string; // nomor kamar polos (mis. "5"), kolom terpisah dari id
  nama: string;
  hp: string;
  status: string;
  label: string; // untuk dropdown & kolom Unit/Penyewa, format baku PRD "KTD-x — Nama" (pakai id, BUKAN kamar)
}

/** Penghuni aktif dari Database Penghuni → sheet DATA. READ-ONLY — jangan pernah ditulis, lihat sheets.ts assertHeaders/READ_ONLY_SHEETS. */
export async function getActiveTenants(): Promise<Tenant[]> {
  return cached('tenants', async () => {
    const rows = await readTable(SHEETS.DATABASE_PENGHUNI, "'DATA'!A:Z");
    if (rows.length === 0) return [];
    const headers = Object.keys(rows[0]);
    const hId = findHeader(headers, 'ID Penghuni', 'id penghuni', 'no. penghuni', 'ktd', 'id');
    const hKamar = findHeader(headers, 'Kamar', 'no. kamar', 'kamar');
    const hNama = findHeader(headers, 'Nama', 'nama lengkap', 'nama');
    const hHp = findHeader(headers, 'No. HP', 'no. hp', 'hp');
    const hStatus = findHeader(headers, 'Status', 'status');
    return rows
      .filter((r) => {
        const s = (r[hStatus] || '').toLowerCase();
        return s.includes('aktif') && !s.includes('non');
      })
      .map((r) => {
        const id = r[hId] || '';
        const kamar = r[hKamar] || '';
        const nama = r[hNama] || '';
        return { id, kamar, nama, hp: r[hHp] || '', status: r[hStatus] || '', label: `${id} — ${nama}` };
      });
  });
}

/**
 * Cari penghuni dari nilai dropdown ("KTD-x — Nama"). Dipakai handler yang perlu tahu nomor
 * kamar penghuni (Modul 2/3/4) — JANGAN parse dari label string, id di label adalah ID Penghuni,
 * bukan nomor kamar (lihat Tenant.id).
 */
export async function getTenantByLabel(label: string): Promise<Tenant | undefined> {
  const tenants = await getActiveTenants();
  return tenants.find((t) => t.label === label);
}

/**
 * Daftar Kas/Bank (KasList) dari Log Input Transaksi → Pengaturan.
 * ⚠️ Sheet ini BUKAN tabel dgn header baris 1 (dikonfirmasi live 8 Jul) — "Pengaturan" adalah sheet
 * key-value (Nama Usaha/Tahun/Bulan dsb di kolom A-B), dan KasList adalah daftar nilai di KOLOM D
 * mulai baris 3 (D2 cuma label "Daftar Akun Kas/Bank (KasList):"). Makanya baca langsung, bukan lewat
 * readTable/findHeader seperti sheet master lain.
 */
export async function getKasList(): Promise<string[]> {
  return cached('kaslist', async () => {
    const rows = await readRange(SHEETS.LOG_INPUT_TRANSAKSI, "'Pengaturan'!D3:D30");
    return Array.from(new Set(rows.map((r) => String(r[0] ?? '').trim()).filter(Boolean)));
  });
}

/** Nilai Tipe Akun — harus sama persis dgn opsi dropdown `tipeAkun` modul Pengeluaran di registry. */
const TIPE_AKUN_OPTIONS = [
  'Aset',
  'Kontra Aset',
  'Liabilitas',
  'Ekuitas',
  'Kontra Ekuitas',
  'Pendapatan',
  'Beban',
  'Beban Non-Operasional'
];

export interface SumberDana {
  tipe: string; // nilai tipeAkun yang memunculkan opsi ini (difilter client via dependsOn/filterBy)
  id: string; // nama akun — ditulis apa adanya ke kolom Akun Kredit sheet Transaksi
  label: string;
}

/**
 * Opsi "Dibayar Dari" (= Akun Kredit) per Tipe Akun — revisi user 10 Jul 2026:
 * - Beban: kas/bank (tunai) ATAU akun "Stok ..." — pemakaian bahan penunjang operasional dari stok
 *   dijurnal Dr Beban X / Cr Stok X, bukan kredit kas.
 * - Beban Non-Operasional (isinya 4 akun Beban Penyusutan): HANYA Akumulasi Penyusutan (Kontra Aset).
 *   Jurnal penyusutan standar PSAK: Dr Beban Penyusutan / Cr Akumulasi Penyusutan — kas sengaja
 *   TIDAK ditawarkan supaya tidak bisa salah jurnal.
 * - Tipe lain: kas/bank (perilaku lama).
 */
export async function getSumberDana(): Promise<SumberDana[]> {
  const [kas, accounts] = await Promise.all([getKasList(), getAccounts()]);
  const rows: SumberDana[] = [];
  const pushKas = (tipe: string) => kas.forEach((k) => rows.push({ tipe, id: k, label: k }));
  for (const tipe of TIPE_AKUN_OPTIONS) {
    if (tipe === 'Beban Non-Operasional') {
      accounts
        .filter((a) => a.tipe === 'Kontra Aset')
        .forEach((a) => rows.push({ tipe, id: a.nama, label: a.nama }));
    } else if (tipe === 'Beban') {
      pushKas(tipe);
      accounts
        .filter((a) => a.tipe === 'Aset' && /^stok\b/i.test(a.nama))
        .forEach((a) => rows.push({ tipe, id: a.nama, label: a.nama }));
    } else {
      pushKas(tipe);
    }
  }
  return rows;
}

/** Nilai dropdown generik dari kolom `column` pada sheet SETTING suatu file (dipakai per modul di Tahap 3+). */
export async function getSettingList(spreadsheetId: string, sheetName: string, column: string): Promise<string[]> {
  return cached(`setting:${spreadsheetId}:${sheetName}:${column}`, async () => {
    const rows = await readTable(spreadsheetId, `'${sheetName}'!A:Z`);
    if (rows.length === 0) return [];
    const headers = Object.keys(rows[0]);
    const hCol = findHeader(headers, column, column);
    return Array.from(new Set(rows.map((r) => (r[hCol] || '').trim()).filter(Boolean)));
  });
}

/** Status Booking (dropdown) dari Log Sales → SETTING. */
export async function getStatusBookingOptions(): Promise<{ id: string; label: string }[]> {
  const list = await getSettingList(SHEETS.LOG_SALES, 'SETTING', 'Status Booking');
  return list.map((v) => ({ id: v, label: v }));
}

/** Sumber Leads (dropdown) dari Log Sales → SETTING. */
export async function getSumberLeadsOptions(): Promise<{ id: string; label: string }[]> {
  const list = await getSettingList(SHEETS.LOG_SALES, 'SETTING', 'Sumber Leads');
  return list.map((v) => ({ id: v, label: v }));
}

/**
 * Dropdown SETTING generik: type = "setting:<SHEETS_KEY>:<namaSheet>:<namaKolom>",
 * mis. "setting:LOG_SALES:SETTING:Dari Mana". Menghindari perlu fungsi getX() baru
 * per dropdown SETTING — dipakai modul-modul Tahap 4-5.
 */
async function getGenericSettingOptions(type: string): Promise<{ id: string; label: string }[]> {
  const [, sheetKey, sheetName, ...colParts] = type.split(':');
  const column = colParts.join(':');
  const spreadsheetId = (SHEETS as Record<string, string>)[sheetKey];
  if (!spreadsheetId) throw new Error(`Spreadsheet key tidak dikenal: "${sheetKey}".`);
  const list = await getSettingList(spreadsheetId, sheetName, column);
  return list.map((v) => ({ id: v, label: v }));
}

export interface InvoiceSewaPenghuni {
  noKamar: string;
  nama: string;
  email: string;
  tipe: string;
}

export interface InvoiceSewaMaster {
  penghuni: InvoiceSewaPenghuni[];
  durasiOptions: number[];
  harga: Record<string, Record<number, number>>; // harga[tipe][durasiBulan] = Rp/bulan
}

/**
 * Master Invoice Generator SEWA (spreadsheet INVOICE_SEWA, sheet "Data") — dibaca POSISI kolom, BUKAN
 * header, karena Apps Script sumbernya (getFormData) juga baca posisi tetap: A=NoKamar B=Nama C=Email
 * D=Tipe (mulai baris 2), dan tabel harga F2:K5 (baris2=header durasi G:K, baris3-5=tipe+harga).
 * Dipakai buat preview invoice — HARUS baca dari sini (bukan Room master Log Sales) supaya angka preview
 * sama persis dgn yang bakal di-generate Apps Script.
 */
async function fetchInvoiceSewaMasterUncached(): Promise<InvoiceSewaMaster> {
  const rows = await readRange(SHEETS.INVOICE_SEWA, "'Data'!A2:D300");
  const penghuni: InvoiceSewaPenghuni[] = rows
    .filter((r) => String(r[1] ?? '').trim() !== '')
    .map((r) => ({
      noKamar: String(r[0] ?? '').trim(),
      nama: String(r[1] ?? '').trim(),
      email: String(r[2] ?? '').trim(),
      tipe: String(r[3] ?? '').trim()
    }));

  const block = await readRange(SHEETS.INVOICE_SEWA, "'Data'!F2:K5");
  const durasiRow = block[0] || [];
  const durasiOptions = durasiRow
    .slice(1)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  const harga: Record<string, Record<number, number>> = {};
  for (let i = 1; i < block.length; i++) {
    const tipe = String(block[i][0] ?? '').trim();
    if (!tipe) continue;
    harga[tipe] = {};
    durasiOptions.forEach((d, j) => {
      harga[tipe][d] = parseNum(block[i][j + 1]);
    });
  }
  return { penghuni, durasiOptions, harga };
}

export async function getInvoiceSewaMaster(): Promise<InvoiceSewaMaster> {
  return cached('invoice-sewa', fetchInvoiceSewaMasterUncached);
}

/** Listrik/bulan per No Kamar — sumber sama dgn getActiveTenants (DATABASE_PENGHUNI/DATA), kolom "Listrik". */
async function fetchListrikByKamarUncached(): Promise<Record<string, number>> {
  const rows = await readTable(SHEETS.DATABASE_PENGHUNI, "'DATA'!A:Z");
  if (rows.length === 0) return {};
  const headers = Object.keys(rows[0]);
  const hKamar = findHeaderOptional(headers, 'No Kamar', 'no. kamar', 'kamar');
  const hListrik = findHeaderOptional(headers, 'Listrik');
  const map: Record<string, number> = {};
  if (!hKamar || !hListrik) return map;
  for (const r of rows) {
    const kamar = String(r[hKamar] ?? '').trim();
    if (!kamar) continue;
    map[kamar] = parseNum(r[hListrik]);
  }
  return map;
}

export async function getListrikByKamar(): Promise<Record<string, number>> {
  return cached('listrik-by-kamar', fetchListrikByKamarUncached);
}

/**
 * Tanggal Masuk per No Kamar — sumber sama dgn Listrik (DATABASE_PENGHUNI/DATA). Kolom OPSIONAL:
 * kalau sheet belum punya kolom ini, kembalikan map kosong — caller (checkout-lookup) HARUS
 * fallback ke instruksi manual, jangan pernah menebak tanggal.
 */
async function fetchTanggalMasukByKamarUncached(): Promise<Record<string, string>> {
  const rows = await readTable(SHEETS.DATABASE_PENGHUNI, "'DATA'!A:Z");
  if (rows.length === 0) return {};
  const headers = Object.keys(rows[0]);
  const hKamar = findHeaderOptional(headers, 'No Kamar', 'no. kamar', 'kamar');
  const hMasuk = findHeaderOptional(headers, 'Tanggal Masuk', 'tgl masuk');
  const map: Record<string, string> = {};
  if (!hKamar || !hMasuk) return map;
  for (const r of rows) {
    const kamar = String(r[hKamar] ?? '').trim();
    if (!kamar) continue;
    map[kamar] = String(r[hMasuk] ?? '').trim();
  }
  return map;
}

export async function getTanggalMasukByKamar(): Promise<Record<string, string>> {
  return cached('tanggal-masuk-by-kamar', fetchTanggalMasukByKamarUncached);
}

export interface InvoiceDpPenghuni {
  noKamar: string;
  nama: string;
  email: string;
  tipe: string;
  hargaKamar: number;
}

/** Master Invoice Generator DP (spreadsheet INVOICE_DP, sheet "Sheet1") — header baris 1 (beda dgn Sewa). */
async function fetchInvoiceDpMasterUncached(): Promise<InvoiceDpPenghuni[]> {
  const rows = await readTable(SHEETS.INVOICE_DP, "'Sheet1'!A:Z");
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const hNama = findHeaderOptional(headers, 'Nama');
  const hEmail = findHeaderOptional(headers, 'Email');
  const hKamar = findHeaderOptional(headers, 'No Kamar', 'kamar');
  const hTipe = findHeaderOptional(headers, 'Tipe Kamar', 'tipe');
  const hHarga = findHeaderOptional(headers, 'Harga Kamar', 'harga');
  if (!hNama || !hKamar) return [];
  return rows
    .filter((r) => String(r[hNama!] ?? '').trim() !== '')
    .map((r) => ({
      noKamar: String(r[hKamar!] ?? '').trim(),
      nama: String(r[hNama!] ?? '').trim(),
      email: hEmail ? String(r[hEmail] ?? '').trim() : '',
      tipe: hTipe ? String(r[hTipe] ?? '').trim() : '',
      hargaKamar: hHarga ? parseNum(r[hHarga]) : 0
    }));
}

export async function getInvoiceDpMaster(): Promise<InvoiceDpPenghuni[]> {
  return cached('invoice-dp', fetchInvoiceDpMasterUncached);
}

// ---- Master dari Turso (Mini App Improvement §5 — pindah kamar berbasis database) ----

/** Penghuni aktif dari Turso. id efektif = "ID Penghuni" bila terisi, fallback kamar_id (PK). */
async function getPenghuniTurso(): Promise<{ id: string; label: string }[]> {
  const { turso } = await import('./turso');
  const res = await turso().execute(
    `SELECT COALESCE("ID Penghuni", kamar_id) id, nama_lengkap, no_kamar
     FROM penghuni WHERE COALESCE(no_kamar, '') != '' ORDER BY nama_lengkap`
  );
  return res.rows.map((r) => ({ id: String(r.id), label: `${r.nama_lengkap} — Kamar ${r.no_kamar}` }));
}

/**
 * Kamar layak jadi tujuan pindah: status bukan Terisi, tidak sedang ditempati
 * penghuni mana pun, dan tanpa booking aktif (Konfirmasi/Check-in).
 */
async function getKamarKosongTurso(): Promise<{ id: string; label: string }[]> {
  const { turso } = await import('./turso');
  const res = await turso().execute(
    `SELECT k.no_kamar, k.tipe_kamar, k.harga_bulan FROM kamar k
     WHERE LOWER(COALESCE(k.status,'')) != 'terisi'
       AND NOT EXISTS (SELECT 1 FROM penghuni p WHERE CAST(p.no_kamar AS TEXT) = CAST(k.no_kamar AS TEXT))
       AND NOT EXISTS (SELECT 1 FROM booking b WHERE b.kamar_no = k.no_kamar AND b.status_booking IN ('Konfirmasi','Check-in'))
     ORDER BY k.no_kamar`
  );
  return res.rows.map((r) => ({
    id: String(r.no_kamar),
    label: `${r.no_kamar} — ${r.tipe_kamar ?? ''} · Rp${Number(r.harga_bulan ?? 0).toLocaleString('id-ID')}/bln`
  }));
}

/** Dispatcher dipakai API /api/master/[type]. */
export async function getMasterData(type: string): Promise<unknown> {
  if (type.startsWith('setting:')) return getGenericSettingOptions(type);
  switch (type) {
    case 'rooms':
      return getRooms();
    case 'rooms-available':
      return getAvailableRooms();
    case 'penghuni-turso':
      return cached('penghuni-turso', getPenghuniTurso);
    case 'kamar-kosong-turso':
      return cached('kamar-kosong-turso', getKamarKosongTurso);
    case 'accounts':
      return getAccounts();
    case 'tenants':
      return getActiveTenants();
    case 'kaslist':
      return (await getKasList()).map((v) => ({ id: v, label: v }));
    case 'sumber-dana':
      return getSumberDana();
    case 'status-booking':
      return getStatusBookingOptions();
    case 'sumber-leads':
      return getSumberLeadsOptions();
    case 'invoice-sewa-durasi': {
      const { durasiOptions } = await getInvoiceSewaMaster();
      return durasiOptions.map((d) => ({ id: String(d), label: `${d} bulan` }));
    }
    default:
      throw new Error(`Tipe master data tidak dikenal: "${type}".`);
  }
}
