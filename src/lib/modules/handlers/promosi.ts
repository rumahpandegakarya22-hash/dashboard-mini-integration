import { createAppendHandler } from './helpers';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, parseRupiah, required } from '../../validate';

// Sheet "Log Promosi" di Log Marketing. Header DIKONFIRMASI dari sheet asli yang dibuat user (8 Jul) —
// lebih lengkap dari rancangan PRD awal. 12 kolom A:L; kolom K (ROI %) adalah FORMULA
// (=IF(F=0,0,(J*I-G)/G)) — JANGAN ditulis, dibiarkan null spt kolom formula lain di proyek ini
// (lihat pola yg sama di penghuni-baru.ts kolom H).
const EXPECTED_HEADERS = [
  'Tanggal Mulai',
  'Tanggal Selesai',
  'Nama Promosi',
  'Platform',
  'Tipe Promosi',
  'Budget (Rp)',
  'Spend Aktual (Rp)',
  'Target (Leads)',
  'Leads Aktual',
  'Booking dari Promo',
  'ROI (%)',
  'Status'
];

function num(v: unknown): number {
  const n = parseInt(String(v ?? '0').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export const submitPromosi = createAppendHandler({
  spreadsheetId: SHEETS.LOG_MARKETING,
  range: "'Log Promosi'!A:L",
  headerRange: "'Log Promosi'!A1:L1",
  expectedHeaders: EXPECTED_HEADERS,
  target: 'Log Marketing → Log Promosi',
  buildRow: (values) => {
    const tanggalMulai = parseDateISO(String(values.tanggalMulai ?? ''));
    const tanggalSelesai = values.tanggalSelesai ? parseDateISO(String(values.tanggalSelesai)) : '';
    const namaPromosi = required(values.namaPromosi, 'Nama Promosi');
    const platform = required(values.platform, 'Platform');
    const tipePromosi = String(values.tipePromosi ?? '').trim();
    const budget = values.budget ? parseRupiah(values.budget as string | number) : 0;
    const spendAktual = values.spendAktual ? parseRupiah(values.spendAktual as string | number) : 0;
    const target = num(values.target);
    const leadsAktual = num(values.leadsAktual);
    const bookingDariPromo = num(values.bookingDariPromo);
    const status = required(values.status, 'Status');
    return [
      tanggalMulai,
      tanggalSelesai,
      namaPromosi,
      platform,
      tipePromosi,
      budget,
      spendAktual,
      target,
      leadsAktual,
      bookingDariPromo,
      null, // K: ROI (%) — FORMULA, jangan ditulis
      status
    ];
  }
});
