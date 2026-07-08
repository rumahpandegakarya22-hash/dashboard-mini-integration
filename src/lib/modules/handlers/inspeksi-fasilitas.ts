import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';

// Sheet "Log Inspeksi Harian". Kolom A (No) = formula (PRD §6 Modul 12).
// ⚠️ Posisi kolom B:H TEBAKAN — belum diverifikasi ke sheet asli.
const EXPECTED_HEADERS = [
  'Tanggal',
  'Area/Fasilitas',
  'Kondisi Ditemukan',
  'Kategori',
  'Tindak Lanjut Diperlukan?',
  'Petugas Inspeksi',
  'Catatan'
];

export const submitInspeksiFasilitas = createAppendHandler({
  spreadsheetId: SHEETS.LOG_INSPEKSI_PERAWATAN,
  range: "'Log Inspeksi Harian'!B:H",
  headerRange: "'Log Inspeksi Harian'!B1:H1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Log Laporan Inspeksi Perawatan Perbaikan → Log Inspeksi Harian',
  buildRow: (values) => {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const areaFasilitas = required(values.areaFasilitas, 'Area/Fasilitas');
    const kondisiDitemukan = required(values.kondisiDitemukan, 'Kondisi Ditemukan');
    const kategori = required(values.kategori, 'Kategori');
    const tindakLanjutPerlu = required(values.tindakLanjutPerlu, 'Tindak Lanjut Diperlukan?');
    const petugas = required(values.petugas, 'Petugas Inspeksi');
    const catatan = String(values.catatan ?? '').trim();
    return [tanggal, areaFasilitas, kondisiDitemukan, kategori, tindakLanjutPerlu, petugas, catatan];
  }
});
