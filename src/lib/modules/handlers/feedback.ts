import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';

// ⚠️ PRD §6 Modul 6: "Header sheet diverifikasi saat build" — nama sheet DAN kolom di bawah
// adalah TEBAKAN (lebih tidak pasti dari modul lain). Sheet ditebak bernama "Logbook".
const EXPECTED_HEADERS = ['Tanggal', 'Sumber', 'Kategori Feedback', 'Isi', 'Tindak Lanjut', 'Status', 'PIC'];

export const submitFeedback = createAppendHandler({
  spreadsheetId: SHEETS.LOGBOOK_FEEDBACK,
  range: "'Logbook'!A:G",
  headerRange: "'Logbook'!A1:G1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Logbook Feedback',
  buildRow: (values) => {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const sumber = required(values.sumber, 'Sumber');
    const kategoriFeedback = required(values.kategoriFeedback, 'Kategori Feedback');
    const isi = required(values.isi, 'Isi');
    const tindakLanjut = String(values.tindakLanjut ?? '').trim();
    const status = required(values.status, 'Status');
    const pic = required(values.pic, 'PIC');
    return [tanggal, sumber, kategoriFeedback, isi, tindakLanjut, status, pic];
  }
});
