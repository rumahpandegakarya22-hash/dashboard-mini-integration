/* =========================================================================
   Kost Tiga Dara — Aturan akses data Dashboard (RLS di server)

   PORT VERBATIM dari `server/server.js` repo Dashboard lama (Fase 2 migrasi).
   Regex TIDAK diubah sedikit pun (§11.2.1) — perubahan sekecil apa pun di sini
   berarti kebocoran data antar-role atau hilangnya akses yang sah (risiko R2).
   ========================================================================= */

/** 5 role Dashboard — daftar & kunci sama dengan Mini App Ops (sumber: lib/core/roles.ts). */
export { DASHBOARD_ROLES, type DashboardRole } from '@/lib/core/roles';

/**
 * Tab spreadsheet yang boleh dilihat tiap role, diuji dengan regex terhadap
 * JUDUL TAB. `owner` tidak ada di peta ini — owner melihat semua (lihat rls.ts).
 */
export const SHEET_ACCESS: Record<string, RegExp[]> = {
  admin_finance: [
    /penghuni/i,
    /keuangan|transaksi|jurnal|kas\b/i,
    /vendor/i,
    /dokumen/i,
    /logbook/i,
    /parameter/i,
    /akun|coa/i,
    /kamar/i
  ],
  marketing: [
    /leads/i,
    /survey/i,
    /post/i,
    /promo/i,
    /marketing/i,
    /dokumen/i,
    /logbook/i,
    /parameter/i,
    /kamar/i,
    /penghuni/i
  ],
  sales: [
    /leads/i,
    /survey/i,
    /booking/i,
    /penghuni/i,
    /kamar/i,
    /dokumen/i,
    /logbook/i,
    /parameter/i,
    /histor|customer|retensi/i
  ],
  operasional: [
    /preventive|corrective|maintenance|inspeksi|perawatan|perbaikan/i,
    /vendor/i,
    /kamar/i,
    /penghuni/i,
    /dokumen/i,
    /logbook/i,
    /parameter/i
  ]
};

/**
 * Kolom PII yang diredaksi dari tab penghuni untuk role selain owner & admin.
 * Diuji terhadap LABEL HEADER (mode sheets) maupun NAMA KOLOM (mode tabel).
 */
export const PII_COLS = /email|kontak|darurat|nama kontak|tgl lahir|tanggal lahir|usia/i;
