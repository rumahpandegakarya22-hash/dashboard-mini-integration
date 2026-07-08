import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, parseRupiah, required } from '../../validate';

// Sheet BARU "Log Promosi" di Log Marketing (belum ada, dibuat saat setup — PRD §6 Modul 8).
const EXPECTED_HEADERS = ['Tanggal Mulai', 'Tanggal Selesai', 'Nama Promo', 'Kanal', 'Budget', 'Target', 'Realisasi', 'Status'];

export const submitPromosi = createAppendHandler({
  spreadsheetId: SHEETS.LOG_MARKETING,
  range: "'Log Promosi'!A:H",
  headerRange: "'Log Promosi'!A1:H1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Log Marketing → Log Promosi',
  buildRow: (values) => {
    const tanggalMulai = parseDateISO(String(values.tanggalMulai ?? ''));
    const tanggalSelesai = values.tanggalSelesai ? parseDateISO(String(values.tanggalSelesai)) : '';
    const namaPromo = required(values.namaPromo, 'Nama Promo');
    const kanal = required(values.kanal, 'Kanal');
    const budget = values.budget ? parseRupiah(values.budget as string | number) : 0;
    const target = String(values.target ?? '').trim();
    const realisasi = String(values.realisasi ?? '').trim();
    const status = required(values.status, 'Status');
    return [tanggalMulai, tanggalSelesai, namaPromo, kanal, budget, target, realisasi, status];
  }
});
