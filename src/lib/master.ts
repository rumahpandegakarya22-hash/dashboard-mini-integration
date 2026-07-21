import { redis, nsKey } from './core/redis';
import { turso } from './core/turso';
import { fetchMaterials } from './inventory';
// Sisa ketergantungan Google Sheets di file ini TINGGAL master tarif Invoice
// Generator (INVOICE_SEWA / INVOICE_DP). Master lain sudah pindah ke Turso di
// Wave 1. Migrasi tarif ke tabel `invoice_harga` tertunda: service account
// belum punya izin baca kedua spreadsheet itu (lihat db/schema/001_*.sql).
import { readRange, readTable } from './core/sheets';
import { SHEETS } from '@/config/spreadsheets';
import { normalizeRoomId } from './core/validate';

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

/** Master kamar dari tabel Turso `kamar` (Wave 1 migrasi Sheets → Turso).
 *  Dulu: LOG_SALES → "1.Daftar Kamar & Harga" via pencocokan header fuzzy.
 *  Kolom kini eksplisit, jadi findHeader() tidak diperlukan lagi di sini. */
async function fetchRoomsUncached(): Promise<Room[]> {
  const res = await turso().execute(
    `SELECT no_kamar, tipe_kamar, harga_bulan, harga_3bulan, harga_6bulan,
            harga_9bulan, harga_tahun, status
     FROM kamar ORDER BY no_kamar`
  );
  return res.rows
    .filter((r) => String(r.no_kamar ?? '').trim() !== '')
    .map((r) => {
      const id = normalizeRoomId(String(r.no_kamar));
      const tipe = String(r.tipe_kamar ?? '');
      const hargaBulan = Number(r.harga_bulan ?? 0);
      return {
        id,
        tipe,
        hargaBulan,
        harga3: Number(r.harga_3bulan ?? 0),
        harga6: Number(r.harga_6bulan ?? 0),
        harga9: Number(r.harga_9bulan ?? 0),
        hargaTahun: Number(r.harga_tahun ?? 0),
        status: String(r.status ?? '').trim(),
        label: `${id} — ${tipe} · Rp${hargaBulan.toLocaleString('id-ID')}/bln`
      };
    });
}

/** Master kamar (Turso `kamar`). */
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

/** Update status kamar di Turso `kamar` (dipakai Modul 3 & 4).
 *  Dulu menulis sel Status di sheet Daftar Kamar & Harga lewat updateRange. */
export async function updateRoomStatus(roomId: string, newStatus: string): Promise<void> {
  const res = await turso().execute({
    sql: 'UPDATE kamar SET status = ? WHERE CAST(no_kamar AS TEXT) = ?',
    args: [newStatus, roomId]
  });
  if (res.rowsAffected === 0) throw new Error(`Kamar ${roomId} tidak ditemukan untuk update status.`);
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
 * Daftar Akun (Turso-only, arahan 2026-07-19): dari tabel `coa` (122 akun, diverifikasi live) —
 * bukan lagi sheet "Daftar Akun". Shape Account dipertahankan agar dropdown & sumber-dana tak berubah.
 */
export async function getAccounts(): Promise<Account[]> {
  return cached('accounts', async () => {
    const res = await turso().execute('SELECT kode, nama_akun, tipe_akun, saldo_normal FROM coa ORDER BY kode');
    return res.rows.map((r) => {
      const kode = String(r.kode ?? '');
      const nama = String(r.nama_akun ?? '');
      return {
        kode,
        nama,
        tipe: String(r.tipe_akun ?? ''),
        saldoNormal: String(r.saldo_normal ?? ''),
        label: kode ? `${kode} — ${nama}` : nama
      };
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

/** Penghuni aktif dari tabel Turso `active_tenant` (Wave 1 migrasi Sheets → Turso).
 *
 *  Dulu: DATABASE_PENGHUNI → sheet DATA (berformula/IMPORTRANGE, READ-ONLY).
 *  `active_tenant` dirawat trigger check-in/check-out di tabel `booking`, jadi
 *  isinya memang hanya penghuni yang sedang aktif — filter status "Aktif" ala
 *  sheet tidak diperlukan lagi. Status dilaporkan 'Aktif' agar bentuk Tenant
 *  (dipakai dropdown & handler) tidak berubah. */
export async function getActiveTenants(): Promise<Tenant[]> {
  return cached('tenants', async () => {
    const res = await turso().execute(
      `SELECT COALESCE(id_penghuni, kamar_id) id, nama_lengkap, no_kamar, no_hp
       FROM active_tenant
       WHERE COALESCE(nama_lengkap, '') != ''
       ORDER BY nama_lengkap`
    );
    return res.rows.map((r) => {
      const id = String(r.id ?? '');
      const nama = String(r.nama_lengkap ?? '');
      return {
        id,
        kamar: String(r.no_kamar ?? ''),
        nama,
        hp: String(r.no_hp ?? ''),
        status: 'Aktif',
        label: `${id} — ${nama}`
      };
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
 * Daftar Kas/Bank (Turso-only, arahan 2026-07-19): akun coa dengan grup_laporan 'Kas & Bank'
 * (live: Uang Kas, Aset Bank, Rekening Ops, Rekening Profit) — bukan lagi sheet "Pengaturan".
 */
export async function getKasList(): Promise<string[]> {
  return cached('kaslist', async () => {
    const res = await turso().execute("SELECT nama_akun FROM coa WHERE grup_laporan = 'Kas & Bank' ORDER BY kode");
    return res.rows.map((r) => String(r.nama_akun ?? '').trim()).filter(Boolean);
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

/**
 * Nilai dropdown dari tabel Turso `settings` (Wave 1 migrasi Sheets → Turso).
 *
 * Dulu membaca tab SETTING tiap spreadsheet lewat Google Sheets API. Sekarang
 * dari `settings` (grup, kolom, nilai, urutan) — di-seed sekali oleh
 * scripts/seed-settings.ts dari db/seed/settings.json.
 *
 * `grup` sengaja tetap memakai kunci lama SHEETS ('LOG_SALES', 'LOG_MARKETING',
 * ...) supaya string master di registry.ts ("setting:LOG_SALES:SETTING:PIC")
 * tidak perlu diubah sama sekali.
 *
 * Parameter `sheetName` dipertahankan agar signature tidak berubah, tapi TIDAK
 * dipakai lagi: seluruh nilai berasal dari satu tab SETTING per file.
 */
export async function getSettingList(grup: string, _sheetName: string, column: string): Promise<string[]> {
  return cached(`setting:${grup}:${column}`, async () => {
    const res = await turso().execute({
      sql: `SELECT nilai FROM settings
            WHERE grup = ? AND kolom = ? AND aktif = 1
            ORDER BY urutan, id`,
      args: [grup, column]
    });
    return res.rows.map((r) => String(r.nilai ?? '').trim()).filter(Boolean);
  });
}

/** Status Booking (dropdown) — settings grup LOG_SALES. */
export async function getStatusBookingOptions(): Promise<{ id: string; label: string }[]> {
  const list = await getSettingList('LOG_SALES', 'SETTING', 'Status Booking');
  return list.map((v) => ({ id: v, label: v }));
}

/** Sumber Leads (dropdown) — settings grup LOG_SALES. */
export async function getSumberLeadsOptions(): Promise<{ id: string; label: string }[]> {
  const list = await getSettingList('LOG_SALES', 'SETTING', 'Sumber Leads');
  return list.map((v) => ({ id: v, label: v }));
}

/**
 * Dropdown SETTING generik: type = "setting:<GRUP>:<namaSheet>:<namaKolom>",
 * mis. "setting:LOG_SALES:SETTING:Dari Mana". Format string TIDAK berubah dari
 * era Sheets — <GRUP> yang dulu kunci SHEETS kini jadi kolom `grup` di Turso.
 */
async function getGenericSettingOptions(type: string): Promise<{ id: string; label: string }[]> {
  const [, grup, sheetName, ...colParts] = type.split(':');
  const column = colParts.join(':');
  if (!grup || !column) throw new Error(`Format master setting tidak valid: "${type}".`);
  const list = await getSettingList(grup, sheetName, column);
  if (list.length === 0) {
    throw new Error(
      `Dropdown "${column}" (grup ${grup}) kosong di tabel settings. Jalankan: npx tsx scripts/seed-settings.ts --commit`
    );
  }
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

/** Listrik/bulan per No Kamar — kolom Turso `kamar.listrik` (Wave 1 migrasi
 *  Sheets → Turso; dulu DATABASE_PENGHUNI/DATA kolom "Listrik").
 *  Kamar tanpa nilai listrik sengaja TIDAK dimasukkan ke map, sama seperti
 *  perilaku lama saat selnya kosong. */
async function fetchListrikByKamarUncached(): Promise<Record<string, number>> {
  const res = await turso().execute(
    'SELECT no_kamar, listrik FROM kamar WHERE listrik IS NOT NULL AND listrik != 0'
  );
  const map: Record<string, number> = {};
  for (const r of res.rows) {
    const kamar = String(r.no_kamar ?? '').trim();
    if (!kamar) continue;
    map[kamar] = Number(r.listrik ?? 0);
  }
  return map;
}

export async function getListrikByKamar(): Promise<Record<string, number>> {
  return cached('listrik-by-kamar', fetchListrikByKamarUncached);
}

/**
 * Tanggal Masuk per No Kamar — kolom Turso `active_tenant.tanggal_masuk` (Wave 1
 * migrasi Sheets → Turso; dulu DATABASE_PENGHUNI/DATA).
 * Nilai OPSIONAL: kamar tanpa tanggal masuk tidak dimasukkan ke map, sehingga
 * caller (checkout-lookup) tetap fallback ke instruksi manual — jangan pernah
 * menebak tanggal.
 */
async function fetchTanggalMasukByKamarUncached(): Promise<Record<string, string>> {
  const res = await turso().execute(
    `SELECT no_kamar, tanggal_masuk FROM active_tenant
     WHERE COALESCE(no_kamar, '') != '' AND COALESCE(tanggal_masuk, '') != ''`
  );
  const map: Record<string, string> = {};
  for (const r of res.rows) {
    const kamar = String(r.no_kamar ?? '').trim();
    if (!kamar) continue;
    map[kamar] = String(r.tanggal_masuk ?? '').trim();
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

/** Penghuni aktif dari Turso. id efektif = id_penghuni bila terisi, fallback kamar_id (PK).
 *
 *  BUG DIPERBAIKI 2026-07-21: dulu query `FROM penghuni` dengan kolom `"ID Penghuni"`.
 *  Tabel `penghuni` TIDAK PERNAH ADA di Turso (dikonfirmasi ke sqlite_master: 24 tabel,
 *  tidak satupun bernama penghuni) sehingga master ini SELALU melempar error — modul
 *  Pindah Kamar praktis tidak bisa dipakai (kedua dropdown-nya gagal memuat; dicek
 *  langsung di produksi: /api/ops/master/penghuni-turso → 400). Tabel yang benar adalah
 *  `active_tenant`, dengan kolom `id_penghuni` (snake_case, bukan berspasi). */
async function getPenghuniTurso(): Promise<{ id: string; label: string }[]> {
  const { turso } = await import('./core/turso');
  const res = await turso().execute(
    `SELECT COALESCE(id_penghuni, kamar_id) id, nama_lengkap, no_kamar
     FROM active_tenant WHERE COALESCE(no_kamar, '') != '' ORDER BY nama_lengkap`
  );
  return res.rows.map((r) => ({ id: String(r.id), label: `${r.nama_lengkap} — Kamar ${r.no_kamar}` }));
}

/**
 * Kamar layak jadi tujuan pindah: status bukan Terisi, tidak sedang ditempati
 * penghuni mana pun, dan tanpa booking aktif (Konfirmasi/Check-in).
 */
async function getKamarKosongTurso(): Promise<{ id: string; label: string }[]> {
  const { turso } = await import('./core/turso');
  const res = await turso().execute(
    `SELECT k.no_kamar, k.tipe_kamar, k.harga_bulan FROM kamar k
     WHERE LOWER(COALESCE(k.status,'')) != 'terisi'
       AND NOT EXISTS (SELECT 1 FROM active_tenant p WHERE CAST(p.no_kamar AS TEXT) = CAST(k.no_kamar AS TEXT))
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
  // Dropdown bahan dari app Inventory Stock: "inventory-materials:<kategori>" (mis. Kebersihan).
  if (type.startsWith('inventory-materials:')) {
    const category = type.slice('inventory-materials:'.length);
    const mats = await fetchMaterials(category);
    return mats.map((m) => ({ id: String(m.id), label: `${m.name} (stok: ${m.currentStock} ${m.unit})` }));
  }
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
