import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';

// Sheet "Log Konten" di Log Marketing. Header DIKONFIRMASI dari sheet asli yang dibuat user (8 Jul) —
// lebih lengkap dari rancangan PRD awal: termasuk kolom performa (Likes/Komentar/Share-Saves/Reach)
// yang biasanya diisi belakangan setelah konten tayang. 13 kolom A:M.
const EXPECTED_HEADERS = [
  'Tanggal Post',
  'Platform',
  'Tipe Konten',
  'Judul/Caption (singkat)',
  'Visual',
  'Link Post',
  'Jam Tayang',
  'Status',
  'Likes',
  'Komentar',
  'Share/Saves',
  'Reach',
  'Catatan'
];

function num(v: unknown): number {
  const n = parseInt(String(v ?? '0').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export const submitKonten = createAppendHandler({
  spreadsheetId: SHEETS.LOG_MARKETING,
  range: "'Log Konten'!A:M",
  headerRange: "'Log Konten'!A1:M1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Log Marketing → Log Konten',
  buildRow: (values) => {
    const tanggalPost = parseDateISO(String(values.tanggalPost ?? ''));
    const platform = required(values.platform, 'Platform');
    const tipeKonten = required(values.jenisKonten, 'Tipe Konten');
    const judulCaption = required(values.judulCaption, 'Judul/Caption');
    const visual = String(values.visual ?? '').trim();
    const linkPost = String(values.linkPost ?? '').trim();
    const jamTayang = String(values.jamTayang ?? '').trim();
    const status = required(values.status, 'Status');
    const likes = num(values.likes);
    const komentar = num(values.komentar);
    const shareSaves = num(values.shareSaves);
    const reach = num(values.reach);
    const catatan = String(values.catatan ?? '').trim();
    return [tanggalPost, platform, tipeKonten, judulCaption, visual, linkPost, jamTayang, status, likes, komentar, shareSaves, reach, catatan];
  }
});
