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

/** Dispatcher dipakai API /api/master/[type]. */
export async function getMasterData(type: string): Promise<unknown> {
  if (type.startsWith('setting:')) return getGenericSettingOptions(type);
  switch (type) {
    case 'rooms':
      return getRooms();
    case 'rooms-available':
      return getAvailableRooms();
    case 'accounts':
      return getAccounts();
    case 'tenants':
      return getActiveTenants();
    case 'kaslist':
      return (await getKasList()).map((v) => ({ id: v, label: v }));
    case 'status-booking':
      return getStatusBookingOptions();
    case 'sumber-leads':
      return getSumberLeadsOptions();
    default:
      throw new Error(`Tipe master data tidak dikenal: "${type}".`);
  }
}
