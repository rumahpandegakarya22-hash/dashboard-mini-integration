// Sisa ID spreadsheet setelah migrasi Sheets → Turso (2026-07-21).
//
// Tinggal SATU yang benar-benar dipakai runtime: LOG_INPUT_TRANSAKSI, oleh
// handlers/pembayaran-sewa.ts. Modul itu sengaja belum dipindah karena
// pencatatan pembayaran adalah hilir generator invoice Apps Script — alasan
// lengkap ada di komentar file handler-nya.
//
// ID lain (LOG_SALES, LOG_MARKETING, LOG_INSPEKSI_PERAWATAN, LOGBOOK_*,
// DATABASE_PENGHUNI, INVOICE_SEWA, INVOICE_DP, AUDIT_LOG, CHECKOUT,
// PINDAH_KAMAR, DAILY_TASK, GENERATOR_TAGIHAN) SUDAH TIDAK DIRUJUK kode dan
// dihapus dari sini. Spreadsheet-nya sendiri JANGAN dihapus dari Drive:
//   - masih jadi sumber data historis yang belum di-backfill ke Turso, dan
//   - INVOICE_SEWA/INVOICE_DP masih dibaca Apps Script generator invoice.

export const SHEETS = {
  LOG_INPUT_TRANSAKSI: '1Ms7So6JlbcPDzH5WHdnTmCt_bn2rqUBd76xBlZaIoTU' // Input Sewa Dimuka (pembayaran-sewa)
} as const;

// Spreadsheet yang TIDAK BOLEH ditulis app (berformula / dikelola sistem lain).
// DATABASE_PENGHUNI dulu di sini; sekarang tidak dirujuk lagi karena seluruh
// pembacaannya sudah pindah ke tabel Turso `active_tenant` + `kamar`.
export const READ_ONLY_SHEETS: string[] = [];
