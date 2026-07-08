import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';

// ⚠️ PRD §6 Modul 10: "Header sheet diverifikasi saat build" — nama sheet DAN kolom di bawah
// adalah TEBAKAN. Sheet ditebak bernama "Logbook".
const EXPECTED_HEADERS = ['Tanggal', 'Area', 'Hasil/Kondisi', 'Temuan', 'Tindak Lanjut', 'Petugas'];

export const submitInspeksiKebersihan = createAppendHandler({
  spreadsheetId: SHEETS.LOGBOOK_INSPEKSI_KEBERSIHAN,
  range: "'Logbook'!A:F",
  headerRange: "'Logbook'!A1:F1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Logbook Inspeksi Kebersihan',
  buildRow: (values) => {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const area = required(values.area, 'Area');
    const hasilKondisi = required(values.hasilKondisi, 'Hasil/Kondisi');
    const temuan = String(values.temuan ?? '').trim();
    const tindakLanjut = String(values.tindakLanjut ?? '').trim();
    const petugas = required(values.petugas, 'Petugas');
    return [tanggal, area, hasilKondisi, temuan, tindakLanjut, petugas];
  }
});
