import { createInsertHandler, type InsertConfig } from './helpers';
import { parseDateISO, required } from '../../core/validate';

/* Wave 2 migrasi Sheets → Turso: dulu append ke LOG_INSPEKSI_PERAWATAN →
   'Log Inspeksi Harian'!B:H. Sekarang INSERT ke tabel `inspeksi_fasilitas`
   (tabel BARU, dibuat di db/schema/001_ops_sheets_to_turso.sql).

   Catatan lama "posisi kolom B:H TEBAKAN — belum diverifikasi" kini TIDAK
   RELEVAN lagi: tujuan bukan posisi kolom sheet, melainkan kolom bernama di
   skema database, jadi tidak ada lagi risiko salah kolom diam-diam. */
export const inspeksiFasilitasInsertCfg: InsertConfig = {
  table: 'inspeksi_fasilitas',
  target: 'Turso → inspeksi_fasilitas',
  buildRow: (values) => ({
    tanggal: parseDateISO(String(values.tanggal ?? '')),
    area_fasilitas: required(values.areaFasilitas, 'Area/Fasilitas'),
    kondisi_ditemukan: required(values.kondisiDitemukan, 'Kondisi Ditemukan'),
    kategori: required(values.kategori, 'Kategori'),
    tindak_lanjut_perlu: required(values.tindakLanjutPerlu, 'Tindak Lanjut Diperlukan?'),
    petugas: required(values.petugas, 'Petugas Inspeksi'),
    catatan: String(values.catatan ?? '').trim()
  })
};

export const submitInspeksiFasilitas = createInsertHandler(inspeksiFasilitasInsertCfg);
