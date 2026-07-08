import { appendRow, assertHeaders } from '../../sheets';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, parseRupiah, required } from '../../validate';
import type { SubmitHandler } from '../types';

// Kolom A:F sheet "Transaksi" (Log Input Transaksi). Kolom G+ berformula, tidak ditulis (PRD §6 Modul 5).
// Header berikut TEBAKAN dari PRD, belum diverifikasi — assertHeaders menolak submit dgn pesan jelas jika beda.
const HEADER_RANGE = "'Transaksi'!A1:F1";
const EXPECTED_HEADERS = ['Tanggal', 'Akun Debit', 'Akun Kredit', 'Nominal', 'Keterangan', 'Kategori'];

export const submitPengeluaran: SubmitHandler = async (values) => {
  const tanggal = parseDateISO(String(values.tanggal ?? ''));
  const akunDebit = required(values.akunDebit, 'Kategori Pengeluaran');
  const akunKredit = required(values.dibayarDari, 'Dibayar Dari');
  const nominal = parseRupiah(values.nominal as string | number);
  const keterangan = required(values.keterangan, 'Keterangan');
  const kategori = required(values.kategori, 'Kategori');

  await assertHeaders(SHEETS.LOG_INPUT_TRANSAKSI, HEADER_RANGE, EXPECTED_HEADERS);
  const row = await appendRow(SHEETS.LOG_INPUT_TRANSAKSI, "'Transaksi'!A:F", [
    tanggal,
    akunDebit,
    akunKredit,
    nominal,
    keterangan,
    kategori
  ]);

  return {
    target: 'Log Input Transaksi → Transaksi',
    row,
    data: { tanggal, akunDebit, akunKredit, nominal, keterangan, kategori }
  };
};
