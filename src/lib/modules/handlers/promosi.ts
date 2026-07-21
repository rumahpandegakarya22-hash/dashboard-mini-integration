import { createInsertHandler, type InsertConfig } from './helpers';
import { parseDateISO, parseRupiahOptional, required } from '../../core/validate';

function num(v: unknown): number {
  const n = parseInt(String(v ?? '0').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/* Wave 2 migrasi Sheets → Turso: dulu append ke Log Marketing → 'Log Promosi'!A:L.
   Sekarang INSERT ke tabel `promotion`.

   Kolom FORMULA sengaja TIDAK ditulis (dibiarkan NULL) — dihitung compute.ts /
   scripts/recompute-turso.ts, lihat FORMULA_COLUMNS.promotion:
     roi_persen, cpl, conv_lead_booking, roi_kotor
   Ini melanjutkan aturan lama "kolom ROI (%) adalah formula, jangan ditulis". */
export const promosiInsertCfg: InsertConfig = {
  table: 'promotion',
  target: 'Turso → promotion',
  buildRow: (values) => ({
    tgl_mulai: parseDateISO(String(values.tanggalMulai ?? '')),
    tgl_selesai: values.tanggalSelesai ? parseDateISO(String(values.tanggalSelesai)) : null,
    nama_promosi: required(values.namaPromosi, 'Nama Promosi'),
    platform: required(values.platform, 'Platform'),
    tipe: String(values.tipePromosi ?? '').trim(),
    budget: parseRupiahOptional(values.budget),
    spend_aktual: parseRupiahOptional(values.spendAktual),
    target_leads: num(values.target),
    leads_aktual: num(values.leadsAktual),
    booking_dr_promo: num(values.bookingDariPromo),
    status: required(values.status, 'Status')
  })
};

export const submitPromosi = createInsertHandler(promosiInsertCfg);
