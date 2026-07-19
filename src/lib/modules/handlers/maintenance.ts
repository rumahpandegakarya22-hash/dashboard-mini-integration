import { turso } from '../../turso';
import { parseDateISO, parseRupiah, required } from '../../validate';
import { saveLampiran } from './helpers';
import type { SubmitHandler } from '../types';

// Turso-only (arahan 2026-07-19): tiket maintenance ditulis ke maintenance_pm/maintenance_cm,
// bukan lagi Google Sheet. Kolom durasi_perbaikan_hari & sla ditulis NULL — Dashboard
// (server/compute.js) menghitung ulang kolom itu (plus `kode`) saat baca.
//
// PEMETAAN KOLOM maintenance_pm TIDAK sesuai namanya (diverifikasi dari isi data live):
//   sumber_laporan  = fasilitas/item (lokasi), mis. "Lampu Koridor Lt.1"
//   lokasi_item     = jenis perawatan, mis. "Penggantian Komponen"
// Jangan "perbaiki" tanpa migrasi data + penyesuaian Dashboard.

/** Kode kategori utk id_tiket {P|K}-{KODE}/{MM-YY}/{NNN}. ELK & FUR terverifikasi dari
 *  data live; SAN/SIP/FAS konvensi konsisten utk kategori yg belum pernah ada di data. */
export const KODE_KATEGORI: Record<string, string> = {
  'Elektrikal dan Elektronik': 'ELK',
  'Sanitasi dan Plumbing': 'SAN',
  'Sipil dan Bangunan': 'SIP',
  'Furniture dan Interior': 'FUR',
  'Fasum dan Keamanan': 'FAS'
};

/** '2026-06-05' → '06-26' (format periode id_tiket, sesuai data live). */
const mmYY = (iso: string) => `${iso.slice(5, 7)}-${iso.slice(2, 4)}`;

/**
 * INSERT tiket dengan no_urut = MAX+1 dan id_tiket digenerate dalam SATU statement
 * (INSERT..SELECT atas tabel yang sama) supaya bebas race tanpa lock aplikasi.
 */
async function insertTiket(
  table: 'maintenance_pm' | 'maintenance_cm',
  prefix: 'P' | 'K',
  kode: string,
  periode: string,
  cols: string[],
  vals: unknown[]
): Promise<string> {
  const db = turso();
  const res = await db.execute({
    sql: `INSERT INTO ${table} (id_tiket, no_urut, kode, ${cols.join(', ')})
          SELECT '${prefix}-' || ? || '/' || ? || '/' || printf('%03d', COALESCE(MAX(no_urut), 0) + 1),
                 COALESCE(MAX(no_urut), 0) + 1, ?, ${cols.map(() => '?').join(', ')}
          FROM ${table}`,
    args: [kode, periode, kode, ...(vals as (string | number | null)[])]
  });
  const r = await db.execute({
    sql: `SELECT id_tiket FROM ${table} WHERE rowid = ?`,
    args: [Number(res.lastInsertRowid ?? 0)]
  });
  return String(r.rows[0]?.id_tiket ?? '');
}

/**
 * Biaya > 0 → baris joblist divisi Admin (work_orders, tujuan_divisi='Admin') supaya
 * Admin mengonversinya jadi pengeluaran (jurnal_transaksi) — biaya TIDAK langsung masuk
 * pembukuan. Best-effort: tiket sudah tersimpan, gagal di sini cuma warning.
 */
async function biayaKeJoblistAdmin(p: {
  tanggal: string;
  lokasi: string;
  kategori: string;
  deskripsi: string;
  prioritas: string;
  petugas: string;
  biaya: number;
  refTiket: string;
  createdBy: string;
}): Promise<string | undefined> {
  if (!p.biaya || p.biaya <= 0) return undefined;
  try {
    await turso().execute({
      sql: `INSERT INTO work_orders
              (tanggal_input, petugas, divisi_asal, lokasi_item, kategori, deskripsi, prioritas,
               tujuan_divisi, status, created_by, nominal, ref_tiket)
            VALUES (?, ?, 'Maintenance', ?, ?, ?, ?, 'Admin', 'Pending', ?, ?, ?)`,
      args: [p.tanggal, p.petugas, p.lokasi, p.kategori, p.deskripsi, p.prioritas, p.createdBy, p.biaya, p.refTiket]
    });
    return undefined;
  } catch (e: unknown) {
    console.error('[maintenance] gagal tulis joblist Admin:', (e as Error)?.message);
    return `Tiket tersimpan, tapi biaya Rp${p.biaya} GAGAL masuk joblist Admin — minta Admin catat pengeluaran manual (ref ${p.refTiket}).`;
  }
}

export const submitPerawatanPreventif: SubmitHandler = async (values, ctx) => {
  const tanggalJadwal = parseDateISO(String(values.tanggalJadwal ?? ''));
  const tanggalSelesai = values.tanggalSelesai ? parseDateISO(String(values.tanggalSelesai)) : null;
  const fasilitasItem = required(values.fasilitasItem, 'Fasilitas/Item');
  const jenisPerawatan = required(values.jenisPerawatan, 'Jenis Perawatan');
  const kategori = required(values.kategori, 'Kategori');
  const kode = KODE_KATEGORI[kategori];
  if (!kode) throw new Error(`Kategori tidak valid: "${kategori}".`);
  const penyebab = String(values.penyebab ?? '').trim() || null;
  const deskripsi = required(values.deskripsi, 'Deskripsi Pekerjaan');
  const prioritas = required(values.prioritas, 'Prioritas');
  const pelaksana = required(values.pelaksana, 'Pelaksana');
  const vendor = String(values.vendor ?? '').trim() || null;
  const biaya = values.biaya ? parseRupiah(values.biaya as string | number) : 0;
  const status = required(values.status, 'Status');
  const catatan = String(values.catatan ?? '').trim() || null;

  const idTiket = await insertTiket(
    'maintenance_pm',
    'P',
    kode,
    mmYY(tanggalJadwal),
    // sumber_laporan = fasilitas/item, lokasi_item = jenis perawatan (lihat catatan atas)
    ['tanggal_lapor', 'tanggal_selesai', 'sumber_laporan', 'lokasi_item', 'kategori', 'penyebab',
     'deskripsi_kerusakan', 'prioritas', 'pelaksana', 'vendor', 'biaya', 'status', 'catatan_dokumentasi'],
    [tanggalJadwal, tanggalSelesai, fasilitasItem, jenisPerawatan, kategori, penyebab,
     deskripsi, prioritas, pelaksana, vendor, biaya || null, status, catatan]
  );

  const joblistWarning = await biayaKeJoblistAdmin({
    tanggal: tanggalSelesai ?? tanggalJadwal,
    lokasi: fasilitasItem,
    kategori,
    deskripsi,
    prioritas,
    petugas: pelaksana,
    biaya,
    refTiket: idTiket,
    createdBy: ctx.user.username
  });
  const lampiranWarning = await saveLampiran(values, ctx, `Perawatan Preventif — ${fasilitasItem} (${idTiket})`, 'Maintenance');

  return {
    target: `Turso → maintenance_pm (${idTiket})`,
    data: { idTiket, tanggalJadwal, fasilitasItem, jenisPerawatan, kategori, biaya, status },
    warning: [joblistWarning, lampiranWarning].filter(Boolean).join(' ') || undefined
  };
};

export const submitPerbaikanKorektif: SubmitHandler = async (values, ctx) => {
  const tanggalKerusakan = parseDateISO(String(values.tanggalKerusakan ?? ''));
  const tanggalLapor = parseDateISO(String(values.tanggalLapor ?? ''));
  const tanggalSelesai = values.tanggalSelesai ? parseDateISO(String(values.tanggalSelesai)) : null;
  const sumberLaporan = required(values.sumberLaporan, 'Sumber Laporan');
  const lokasiItem = required(values.lokasiItem, 'Lokasi/Item Rusak');
  const kategori = required(values.kategori, 'Kategori');
  const kode = KODE_KATEGORI[kategori];
  if (!kode) throw new Error(`Kategori tidak valid: "${kategori}".`);
  const penyebab = String(values.penyebab ?? '').trim() || null;
  const deskripsi = required(values.deskripsi, 'Deskripsi Kerusakan');
  const prioritas = required(values.prioritas, 'Prioritas');
  const pelaksana = String(values.pelaksana ?? '').trim() || null;
  const vendor = String(values.vendor ?? '').trim() || null;
  const biaya = values.biaya ? parseRupiah(values.biaya as string | number) : 0;
  const status = required(values.status, 'Status');
  const catatan = String(values.catatan ?? '').trim() || null;

  const idTiket = await insertTiket(
    'maintenance_cm',
    'K',
    kode,
    mmYY(tanggalLapor),
    ['tanggal_kerusakan', 'tanggal_lapor', 'tanggal_selesai', 'sumber_laporan', 'lokasi_item', 'kategori',
     'penyebab', 'deskripsi_kerusakan', 'prioritas', 'pelaksana', 'vendor', 'biaya', 'status', 'catatan_dokumentasi'],
    [tanggalKerusakan, tanggalLapor, tanggalSelesai, sumberLaporan, lokasiItem, kategori,
     penyebab, deskripsi, prioritas, pelaksana, vendor, biaya || null, status, catatan]
  );

  const joblistWarning = await biayaKeJoblistAdmin({
    tanggal: tanggalSelesai ?? tanggalLapor,
    lokasi: lokasiItem,
    kategori,
    deskripsi,
    prioritas,
    petugas: pelaksana ?? ctx.user.username,
    biaya,
    refTiket: idTiket,
    createdBy: ctx.user.username
  });
  const lampiranWarning = await saveLampiran(values, ctx, `Perbaikan Korektif — ${lokasiItem} (${idTiket})`, 'Maintenance');

  return {
    target: `Turso → maintenance_cm (${idTiket})`,
    data: { idTiket, tanggalKerusakan, lokasiItem, kategori, biaya, status },
    warning: [joblistWarning, lampiranWarning].filter(Boolean).join(' ') || undefined
  };
};
