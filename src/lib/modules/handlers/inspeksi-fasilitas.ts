import { createInsertHandler, type InsertConfig } from './helpers';
import { parseDateISO, required } from '../../core/validate';
import { kodeTanggal } from './inspeksi-kebersihan';

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
  }),
  // Kategori diambil dari field form-nya (modul ini punya dropdown Kategori).
  lampiran: {
    judul: (v) => `Inspeksi Fasilitas — ${String(v.areaFasilitas ?? '')} (${String(v.tanggal ?? '')})`,
    role: 'Inspeksi',
    penamaan: (v, rowId) => ({
      jenis: 'Foto Inspeksi',
      idDocs: `${kodeTanggal(String(v.tanggal ?? ''))}-${String(v.kategori ?? 'Fasilitas')}-${String(rowId ?? 0).padStart(3, '0')}`
    })
  }
};

export const submitInspeksiFasilitas = createInsertHandler(inspeksiFasilitasInsertCfg);
