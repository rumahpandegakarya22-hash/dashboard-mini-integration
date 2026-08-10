/* =========================================================================
   Kost Tiga Dara — Sumber Data Turso untuk dashboard (ON-READ)

   PORT VERBATIM dari `server/turso-source.js` + bagian baca dari
   `server/turso.js` repo Dashboard lama (Fase 2 migrasi).

   Menyatukan:  baca Turso  →  compute.ts (hitung kolom formula)
                →  sheet-map.ts (render ke bentuk tab spreadsheet).

   Mengekspor:
     • readComputedTables()  → { table: [rowObject terhitung] }   (untuk /api/dashboard/db)
     • readComputedSheets()  → { "NAMA TAB": [[header],[row]...] } (untuk /api/dashboard/sheets)

   Selain tabel Turso, adapter juga MEN-TURUNKAN tab "PENGHUNI" dari data
   booking + kamar, karena migrasi tidak membuat tabel penghuni tersendiri
   sedangkan dashboard butuh daftar penghuni aktif (okupansi, jatuh tempo).

   Catatan port:
   - Klien libSQL diambil dari `lib/core/turso.ts` (DB & env sama persis),
     bukan klien kedua — lihat §3 yang menempatkan turso di lib/core.
   - Cache in-memory 60 detik dipertahankan APA ADANYA di sini. Mitigasi R6
     (unstable_cache Next agar efektif di serverless) diterapkan di lapisan
     Route Handler pada Fase 3, bukan dengan mengubah modul ini.
   ========================================================================= */

import { turso } from '@/lib/core/turso';
import { computeAll, type DbRow, type DbTables } from './compute';
import { SHEET_MAP } from './sheet-map';

/** Daftar tabel yang dibaca dashboard — verbatim dari server/turso.js. */
const TABLES = [
  'kamar',
  'booking',
  'leads',
  'survey',
  'coa',
  'jurnal_transaksi',
  'maintenance_cm',
  'maintenance_pm',
  'vendor',
  'content',
  'promotion',
  'dokumen',
  'logbook_divisi',
  'occupancy_history',
  'payment',
  'active_tenant'
];

export type SheetGrid = (string | number | null)[][];
export type SheetsOut = Record<string, SheetGrid>;

const TTL = 10 * 1000; // cache 10 detik
let cache: { at: number; tables: DbTables | null; sheets: SheetsOut | null } = {
  at: 0,
  tables: null,
  sheets: null
};

export function isConfigured(): boolean {
  return !!process.env.TURSO_DATABASE_URL;
}

/* Baca 1 tabel → array of row-object (kolom → nilai). */
export async function readTable(name: string): Promise<DbRow[]> {
  const rs = await turso().execute(`SELECT * FROM "${name}"`);
  return rs.rows.map((row: any) => {
    // rs.rows sudah object-like; salin agar plain object murni
    const o: DbRow = {};
    for (const col of rs.columns) o[col] = row[col];
    return o;
  });
}

/* Baca SEMUA tabel → { tableName: [rows] }. Tabel yang error (mis. belum ada)
   dikembalikan sebagai array kosong + dicatat, tidak menggagalkan keseluruhan. */
export async function readAllTables(): Promise<DbTables> {
  const out: DbTables = {};
  for (const t of TABLES) {
    try {
      out[t] = await readTable(t);
    } catch (e: any) {
      out[t] = [];
      console.warn(`[turso] gagal baca tabel ${t}: ${e?.message}`);
    }
  }
  return out;
}

function fmtCell(v: any): any {
  if (v === null || v === undefined) return '';
  return v;
}

/* Ubah {table: rows} terhitung → {tabTitle: 2D array} sesuai SHEET_MAP. */
export function toSheets(tables: DbTables): SheetsOut {
  const out: SheetsOut = {};
  for (const [table, def] of Object.entries(SHEET_MAP)) {
    const rows = tables[table] || [];
    const header = def.columns.map((x) => x.header);
    const body = rows.map((r) => def.columns.map((x) => fmtCell(r[x.col])));
    out[def.title] = [header, ...body];
  }
  // Tab turunan PENGHUNI (dari booking aktif + master kamar)
  out['PENGHUNI (dari Booking)'] = derivePenghuni(tables);
  return out;
}

/* Turunkan daftar penghuni AKTIF dari booking. Status yang dihitung sebagai
   penghuni saat ini: selain "Check-out" dan yang dibatalkan (Cancel/Batal).
   Diperkaya profil dari tabel `active_tenant` (kontak darurat 2 set, email, dll;
   dirawat trigger check-in/out) — match by id_penghuni, lalu nama
   (case-insensitive), lalu fallback no kamar. */
export function derivePenghuni(tables: DbTables): SheetGrid {
  const kamarByNo: Record<string, DbRow> = {};
  for (const k of tables.kamar || []) kamarByNo[String(k.no_kamar)] = k;
  const profById: Record<string, DbRow> = {};
  const profByNama: Record<string, DbRow> = {};
  const profByKamar: Record<string, DbRow> = {};
  for (const p of tables.active_tenant || tables.penghuni || []) {
    if (p.id_penghuni) profById[String(p.id_penghuni).trim()] = p;
    if (p.nama_lengkap) profByNama[String(p.nama_lengkap).trim().toLowerCase()] = p;
    if (p.no_kamar != null && p.no_kamar !== '') profByKamar[String(p.no_kamar).trim()] = p;
  }

  const header = [
    'No',
    'ID Penghuni',
    'Nama Lengkap',
    'Panggilan',
    'No Kamar',
    'Jenis Kamar',
    'Asal Daerah',
    'Pekerjaan',
    'Instansi',
    'Tgl Masuk',
    'Jatuh Tempo',
    'Durasi',
    'Status',
    'No HP Penghuni',
    'Nomor Darurat 1',
    'Relasi 1',
    'Nama Kontak 1',
    'Nomor Darurat 2',
    'Relasi 2',
    'Nama Kontak 2',
    'Email'
  ];

  const aktif = (s: any): boolean => {
    const t = String(s || '').toLowerCase();
    return !!t && !/check-?out|keluar|cancel|batal/.test(t);
  };
  const v = (x: any): any => (x == null ? '' : x);

  let n = 0;
  const body: SheetGrid = (tables.booking || [])
    .filter((b) => b.nama_penyewa && aktif(b.status_booking))
    .map((b) => {
      n++;
      const km = kamarByNo[String(b.kamar_no)];
      const pr =
        profById[String(b.id_penghuni || '').trim()] ||
        profByNama[String(b.nama_penyewa).trim().toLowerCase()] ||
        profByKamar[String(b.kamar_no)] ||
        {};
      return [
        n,
        v(b.id_penghuni),
        b.nama_penyewa,
        v(pr.nama_panggilan),
        b.kamar_no != null ? b.kamar_no : '',
        km ? km.tipe_kamar : '',
        v(pr.asal_daerah),
        v(pr.pekerjaan),
        v(pr.instansi),
        b.tgl_masuk || '',
        b.tgl_keluar_est || '', // dipakai sbg "Jatuh Tempo" (akhir kontrak)
        b.durasi_bulan != null ? b.durasi_bulan : '',
        b.status_booking || '',
        b.no_hp || v(pr.no_hp),
        v(pr.nomor_darurat_1),
        v(pr.hubungan_kontak_darurat_1),
        v(pr.nama_kontak_darurat_1),
        v(pr.nomor_darurat_2),
        v(pr.hubungan_kontak_darurat_2),
        v(pr.nama_kontak_darurat_2),
        v(pr.email)
      ];
    });

  // Penghuni lama (check-in sebelum sistem booking) hanya ada di active_tenant —
  // tanpa baris booking. Tambahkan agar daftar penghuni & okupansi lengkap.
  const seenId = new Set<string>();
  const seenKamar = new Set<string>();
  for (const r of body) {
    if (r[1]) seenId.add(String(r[1]).trim());
    if (r[4] !== '') seenKamar.add(String(r[4]));
  }
  for (const p of tables.active_tenant || tables.penghuni || []) {
    if (!p.nama_lengkap) continue;
    const noKamar = String(
      p.no_kamar != null && p.no_kamar !== ''
        ? p.no_kamar
        : String(p.kamar_id || '').replace(/[^0-9]/g, '')
    );
    if (
      (p.id_penghuni && seenId.has(String(p.id_penghuni).trim())) ||
      (noKamar && seenKamar.has(noKamar))
    )
      continue;
    n++;
    const km = kamarByNo[noKamar];
    body.push([
      n,
      v(p.id_penghuni),
      p.nama_lengkap,
      v(p.nama_panggilan),
      noKamar,
      km ? km.tipe_kamar : '',
      v(p.asal_daerah),
      v(p.pekerjaan),
      v(p.instansi),
      v(p.tanggal_masuk),
      '',
      '',
      'Aktif',
      v(p.no_hp),
      v(p.nomor_darurat_1),
      v(p.hubungan_kontak_darurat_1),
      v(p.nama_kontak_darurat_1),
      v(p.nomor_darurat_2),
      v(p.hubungan_kontak_darurat_2),
      v(p.nama_kontak_darurat_2),
      v(p.email)
    ]);
  }
  return [header, ...body];
}

async function loadAll(force?: boolean) {
  if (!force && cache.tables && Date.now() - cache.at < TTL) return cache;
  const raw = await readAllTables();
  const computed = computeAll(raw);
  cache = { at: Date.now(), tables: computed, sheets: toSheets(computed) };
  return cache;
}

export async function readComputedTables(force?: boolean): Promise<DbTables> {
  return (await loadAll(force)).tables!;
}

export async function readComputedSheets(force?: boolean): Promise<SheetsOut> {
  return (await loadAll(force)).sheets!;
}
