import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';

// Sheet BARU "Log Konten" di Log Marketing (belum ada, dibuat saat setup — PRD §6 Modul 8).
const EXPECTED_HEADERS = ['Tanggal', 'Platform', 'Jenis Konten', 'Judul/Tema', 'Link', 'Status', 'PIC'];

export const submitKonten = createAppendHandler({
  spreadsheetId: SHEETS.LOG_MARKETING,
  range: "'Log Konten'!A:G",
  headerRange: "'Log Konten'!A1:G1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Log Marketing → Log Konten',
  buildRow: (values) => {
    const tanggal = parseDateISO(String(values.tanggal ?? ''));
    const platform = required(values.platform, 'Platform');
    const jenisKonten = required(values.jenisKonten, 'Jenis Konten');
    const judulTema = required(values.judulTema, 'Judul/Tema');
    const link = String(values.link ?? '').trim();
    const status = required(values.status, 'Status');
    const pic = required(values.pic, 'PIC');
    return [tanggal, platform, jenisKonten, judulTema, link, status, pic];
  }
});
