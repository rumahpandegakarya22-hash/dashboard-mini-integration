import { createAppendHandler, type AppendConfig } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, parseRupiah, required } from '../../validate';

// Sheet "Log Perbaikan Korektif". Kolom A-D (No, Kode, ID Tiket, Durasi Perbaikan) = formula (PRD §6 Modul 11).
// ⚠️ Posisi kolom E:R TEBAKAN — sama seperti Modul 9, belum diverifikasi ke sheet asli.
const EXPECTED_HEADERS = [
  'Tanggal Kerusakan',
  'Tanggal Lapor',
  'Tanggal Selesai',
  'Sumber Laporan',
  'Lokasi/Item Rusak',
  'Kategori',
  'Penyebab',
  'Deskripsi Kerusakan',
  'Prioritas',
  'Pelaksana',
  'Vendor',
  'Biaya',
  'Status',
  'Catatan/Dokumentasi'
];

export const perbaikanKorektifAppendCfg: AppendConfig = {
  spreadsheetId: SHEETS.LOG_INSPEKSI_PERAWATAN,
  range: "'Log Perbaikan Korektif'!E:R",
  headerRange: "'Log Perbaikan Korektif'!E1:R1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Log Laporan Inspeksi Perawatan Perbaikan → Log Perbaikan Korektif',
  lampiran: { judul: (v) => `Perbaikan Korektif — ${String(v.lokasiItem ?? '')}`, role: 'Maintenance' },
  buildRow: (values) => {
    const tanggalKerusakan = parseDateISO(String(values.tanggalKerusakan ?? ''));
    const tanggalLapor = parseDateISO(String(values.tanggalLapor ?? ''));
    const tanggalSelesai = values.tanggalSelesai ? parseDateISO(String(values.tanggalSelesai)) : '';
    const sumberLaporan = required(values.sumberLaporan, 'Sumber Laporan');
    const lokasiItem = required(values.lokasiItem, 'Lokasi/Item Rusak');
    const kategori = required(values.kategori, 'Kategori');
    const penyebab = String(values.penyebab ?? '').trim();
    const deskripsi = required(values.deskripsi, 'Deskripsi Kerusakan');
    const prioritas = required(values.prioritas, 'Prioritas');
    const pelaksana = String(values.pelaksana ?? '').trim();
    const vendor = String(values.vendor ?? '').trim();
    const biaya = values.biaya ? parseRupiah(values.biaya as string | number) : 0;
    const status = required(values.status, 'Status');
    const catatan = String(values.catatan ?? '').trim();
    return [
      tanggalKerusakan,
      tanggalLapor,
      tanggalSelesai,
      sumberLaporan,
      lokasiItem,
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
};

export const submitPerbaikanKorektif = createAppendHandler(perbaikanKorektifAppendCfg);
