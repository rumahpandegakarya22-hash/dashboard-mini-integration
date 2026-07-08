import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, parseRupiah, required } from '../../validate';

// Sheet "Log Perawatan Preventif". Kolom A-C (No, Kode, ID TIKET) = formula (PRD §6 Modul 9).
// ⚠️ Posisi kolom D:P TEBAKAN (urutan formula-vs-input tidak dikonfirmasi persis) — lebih tidak
// pasti dari Modul 1/7. assertHeaders akan menolak submit dgn pesan jelas jika meleset; wajib
// diverifikasi ke sheet asli sebelum UAT modul ini.
const EXPECTED_HEADERS = [
  'Tanggal Jadwal',
  'Tanggal Selesai',
  'Fasilitas/Item',
  'Jenis Perawatan',
  'Kategori',
  'Penyebab',
  'Deskripsi Pekerjaan',
  'Prioritas',
  'Pelaksana',
  'Vendor',
  'Biaya',
  'Status',
  'Catatan/Dokumentasi'
];

export const submitPerawatanPreventif = createAppendHandler({
  spreadsheetId: SHEETS.LOG_INSPEKSI_PERAWATAN,
  range: "'Log Perawatan Preventif'!D:P",
  headerRange: "'Log Perawatan Preventif'!D1:P1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Log Laporan Inspeksi Perawatan Perbaikan → Log Perawatan Preventif',
  buildRow: (values) => {
    const tanggalJadwal = parseDateISO(String(values.tanggalJadwal ?? ''));
    const tanggalSelesai = values.tanggalSelesai ? parseDateISO(String(values.tanggalSelesai)) : '';
    const fasilitasItem = required(values.fasilitasItem, 'Fasilitas/Item');
    const jenisPerawatan = required(values.jenisPerawatan, 'Jenis Perawatan');
    const kategori = required(values.kategori, 'Kategori');
    const penyebab = String(values.penyebab ?? '').trim();
    const deskripsi = required(values.deskripsi, 'Deskripsi Pekerjaan');
    const prioritas = required(values.prioritas, 'Prioritas');
    const pelaksana = required(values.pelaksana, 'Pelaksana');
    const vendor = String(values.vendor ?? '').trim();
    const biaya = values.biaya ? parseRupiah(values.biaya as string | number) : 0;
    const status = required(values.status, 'Status');
    const catatan = String(values.catatan ?? '').trim();
    return [
      tanggalJadwal,
      tanggalSelesai,
      fasilitasItem,
      jenisPerawatan,
      kategori,
      penyebab,
      deskripsi,
      prioritas,
      pelaksana,
      vendor,
      biaya,
      status,
      catatan
    ];
  }
});
