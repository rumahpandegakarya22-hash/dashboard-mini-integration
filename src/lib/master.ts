import { redis, nsKey } from './core/redis';
import { turso } from './core/turso';
import { fetchMaterials } from './inventory';
import { normalizeRoomId } from './core/validate';

/* File ini SUDAH BEBAS Google Sheets sejak master tarif invoice ikut pindah ke
   tabel `kamar` (2026-07-21). Seluruh master kini dari Turso. */

const TTL_SEC = 300; // 5 menit, sesuai PRD §8.4

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cacheKey = nsKey(`master:${key}`);
  const hit = await redis.get<T>(cacheKey);
  if (hit !== null && hit !== undefined) return hit;
  const val = await fn();
  await redis.set(cacheKey, val, { ex: TTL_SEC });
  return val;
}

/* findHeader / findHeaderOptional / parseNum DIHAPUS: itu alat pencocokan header
   sheet yang longgar, tidak relevan lagi karena kolom sekarang dirujuk by nama
   dari skema database. */

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

/** Bersihkan cache dropdown penghuni aktif (5 menit) — WAJIB dipanggil tiap kali booking
 *  check-in/check-out/edit bisa mengubah isi `active_tenant` (trigger DB), supaya dropdown
 *  langsung sinkron alih-alih nunggu TTL habis. Sama seperti redis.del('master:rooms') di
 *  updateRoomStatus di atas — bug lama: cache ini tidak pernah di-invalidate sama sekali. */
export async function invalidateTenantsCache(): Promise<void> {
  await redis.del(nsKey('master:tenants'));
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

/** Durasi sewa yang punya kolom tarif sendiri di tabel `kamar`. */
export const DURASI_TIER: { bulan: number; kolom: string }[] = [
  { bulan: 1, kolom: 'harga_bulan' },
  { bulan: 3, kolom: 'harga_3bulan' },
  { bulan: 6, kolom: 'harga_6bulan' },
  { bulan: 9, kolom: 'harga_9bulan' },
  { bulan: 12, kolom: 'harga_tahun' }
];

/**
 * Master Invoice SEWA — SUMBER TUNGGAL: tabel Turso `kamar` + `active_tenant`.
 *
 * Dulu membaca spreadsheet INVOICE_SEWA "Data" (daftar penghuni A:D + blok tarif
 * F2:K5) secara POSISIONAL. Blok tarif itu ternyata MENDUPLIKASI kolom tier yang
 * sudah ada di `kamar` (harga_bulan / 3bulan / 6bulan / 9bulan / tahun) —
 * diverifikasi terhadap invoice nyata: Eco 1bln 850rb & 3bln 800rb, Classic 3bln
 * 1,2jt semuanya cocok dgn tier `kamar`. Dua sumber kebenaran untuk angka yang
 * sama persis adalah akar masalah yang sedang dihapus migrasi ini, jadi tarif
 * kini HANYA dari `kamar` dan bisa diubah Owner lewat UI Kelola Harga Kamar.
 *
 * harga[tipe][durasi] = Rp PER BULAN (kolom tier dibagi jumlah bulannya).
 */
async function fetchInvoiceSewaMasterUncached(): Promise<InvoiceSewaMaster> {
  const kamarRes = await turso().execute(
    `SELECT no_kamar, tipe_kamar, harga_bulan, harga_3bulan, harga_6bulan, harga_9bulan, harga_tahun
     FROM kamar ORDER BY no_kamar`
  );

  const harga: Record<string, Record<number, number>> = {};
  for (const r of kamarRes.rows) {
    const tipe = String(r.tipe_kamar ?? '').trim();
    if (!tipe || harga[tipe]) continue; // tarif seragam per tipe — cukup baris pertama
    harga[tipe] = {};
    for (const { bulan, kolom } of DURASI_TIER) {
      const total = Number((r as Record<string, unknown>)[kolom] ?? 0);
      if (total > 0) harga[tipe][bulan] = Math.round(total / bulan);
    }
  }

  const tenantRes = await turso().execute(
    `SELECT t.no_kamar, t.nama_lengkap, t.email, k.tipe_kamar
     FROM active_tenant t LEFT JOIN kamar k ON CAST(k.no_kamar AS TEXT) = CAST(t.no_kamar AS TEXT)
     WHERE COALESCE(t.nama_lengkap, '') != '' AND COALESCE(t.no_kamar, '') != ''
     ORDER BY CAST(t.no_kamar AS INTEGER)`
  );
  const penghuni: InvoiceSewaPenghuni[] = tenantRes.rows.map((r) => ({
    noKamar: String(r.no_kamar ?? '').trim(),
    nama: String(r.nama_lengkap ?? '').trim(),
    email: String(r.email ?? '').trim(),
    tipe: String(r.tipe_kamar ?? '').trim()
  }));

  const durasiOptions = DURASI_TIER.map((d) => d.bulan).filter((b) =>
    Object.values(harga).some((h) => h[b] > 0)
  );
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

/**
 * Master Invoice DP — SUMBER TUNGGAL: `active_tenant` + `kamar` (dulu spreadsheet
 * INVOICE_DP "Sheet1").
 *
 * `hargaKamar` = tarif sewa 1 bulan kamar tsb (`kamar.harga_bulan`). Nominal DP
 * TIDAK disimpan: dihitung 50% dari hargaKamar di pembayaran-sewa-preview
 * (`Math.round(p.hargaKamar / 2)`, label "Harga/unit (DP 50%)") — aturan 50% itu
 * memang sudah dipakai kode sejak awal dan dikonfirmasi Owner 2026-07-21.
 *
 * CATATAN DATA LAMA: invoice DP historis tipe Eco tercatat Rp300.000, padahal
 * 50% × 850.000 = 425.000. Penyebabnya sheet DP lama menyimpan "Harga Kamar" Eco
 * berbeda dari tarif kamar sebenarnya. Invoice lama TIDAK diubah; aturan 50%
 * berlaku untuk invoice baru.
 */
async function fetchInvoiceDpMasterUncached(): Promise<InvoiceDpPenghuni[]> {
  const res = await turso().execute(
    `SELECT t.no_kamar, t.nama_lengkap, t.email, k.tipe_kamar, k.harga_bulan
     FROM active_tenant t LEFT JOIN kamar k ON CAST(k.no_kamar AS TEXT) = CAST(t.no_kamar AS TEXT)
     WHERE COALESCE(t.nama_lengkap, '') != '' AND COALESCE(t.no_kamar, '') != ''
     ORDER BY CAST(t.no_kamar AS INTEGER)`
  );
  return res.rows.map((r) => ({
    noKamar: String(r.no_kamar ?? '').trim(),
    nama: String(r.nama_lengkap ?? '').trim(),
    email: String(r.email ?? '').trim(),
    tipe: String(r.tipe_kamar ?? '').trim(),
    hargaKamar: Number(r.harga_bulan ?? 0)
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
  /* Dropdown bahan dari DB Inventory Stock.
     `inventory-materials` = seluruh bahan; `inventory-materials:<kategori>`
     = disaring kategori.

     Modul pemakaian stok sekarang memakai bentuk TANPA kategori. Sebelumnya
     Cleaning dikunci ke "Kebersihan" dan Maintenance ke "Perawatan Kamar",
     padahal kategori yang benar-benar ada di DB cuma "Kebersihan" dan
     "Fasilitas Umum" — dropdown Maintenance karena itu selalu kosong, tanpa
     satu pun pesan error. Menyaring pakai string yang ditulis manual di dua
     tempat berbeda memang rapuh: kategori diganti nama di app Inventory,
     dropdown di sini mati diam-diam. */
  if (type.startsWith('inventory-materials')) {
    const category = type.startsWith('inventory-materials:')
      ? type.slice('inventory-materials:'.length)
      : '';
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
