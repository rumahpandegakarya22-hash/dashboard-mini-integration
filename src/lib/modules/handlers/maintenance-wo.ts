import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';
import type { SubmitHandler } from '../types';

// Tab BARU "Log Maintenance Work Order" di file Log Inspeksi & Perawatan.
// Mengikuti konvensi tab lain di file itu: kolom A (No) = formula, data mulai kolom B.
// Kontrak kolom yang harus dibuat di baris 1 kolom B:K:
const EXPECTED_HEADERS = [
  'Tanggal WO',
  'Petugas Inspeksi',
  'Lokasi/Item',
  'Kategori',
  'Deskripsi Pekerjaan',
  'Prioritas',
  'Ditugaskan Ke',
  'Target Selesai',
  'Status',
  'Catatan'
];

const append = createAppendHandler({
  spreadsheetId: SHEETS.LOG_INSPEKSI_PERAWATAN,
  range: "'Log Maintenance Work Order'!B:K",
  headerRange: "'Log Maintenance Work Order'!B1:K1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Log Laporan Inspeksi Perawatan Perbaikan → Log Maintenance Work Order',
  buildRow: (values) => {
    const tanggalWo = parseDateISO(String(values.tanggalWo ?? ''));
    const petugasInspeksi = required(values.petugasInspeksi, 'Petugas Inspeksi');
    const lokasiItem = required(values.lokasiItem, 'Lokasi/Item');
    const kategori = required(values.kategori, 'Kategori');
    const deskripsi = required(values.deskripsi, 'Deskripsi Pekerjaan');
    const prioritas = required(values.prioritas, 'Prioritas');
    const ditugaskanKe = required(values.ditugaskanKe, 'Ditugaskan Ke');
    const targetSelesai = String(values.targetSelesai ?? '').trim() ? parseDateISO(String(values.targetSelesai)) : '';
    const status = required(values.status, 'Status');
    const catatan = String(values.catatan ?? '').trim();
    return [tanggalWo, petugasInspeksi, lokasiItem, kategori, deskripsi, prioritas, ditugaskanKe, targetSelesai, status, catatan];
  }
});

export const submitMaintenanceWo: SubmitHandler = async (values, ctx) => {
  try {
    return await append(values, ctx);
  } catch (e) {
    if (e instanceof Error && /Unable to parse range/i.test(e.message)) {
      throw new Error(
        'Tab "Log Maintenance Work Order" belum ada di spreadsheet Log Inspeksi & Perawatan. ' +
          `Buat tab itu dengan kolom B1:K1 = ${EXPECTED_HEADERS.join(' | ')} (kolom A untuk No/formula).`
      );
    }
    throw e;
  }
};
