// ID spreadsheet aktual (hasil audit Drive 7 Juli 2026).
// Spreadsheet BARU (audit log, pindah kamar, checkout) diisi via env karena dibuat saat setup.

export const SHEETS = {
  LOG_SALES: '1D5DO-_1RJaNw4kFOhGlkk9VwlllNUShlS2FRMrggDpQ', // Daftar Kamar & Harga, Log Survey, Log Booking, SETTING
  LOG_INPUT_TRANSAKSI: '1Ms7So6JlbcPDzH5WHdnTmCt_bn2rqUBd76xBlZaIoTU', // Pengaturan, Input Sewa Dimuka, Transaksi, Daftar Akun
  GENERATOR_TAGIHAN: '1Ji0FAEkXi86b1Q-dr4MbwENMb5ZaqEVB_AURnKduSpw',
  LOGBOOK_MARKETING: '1RIfdj7g7KmHPUemQdjBqJVgzaVztB7woW_W_TE1DKeM', // staff input kegiatan kerja harian (BUKAN leads/konten/promosi) — belum ada modul
  LOG_MARKETING: '1fZ4DHZx8uasta5mfttWhQhfrPOpprb8VrpEPFUGI2FE', // sheet Log Leads Harian/Log Konten/Log Promosi (dibuat saat setup) — Modul 8
  LOG_INSPEKSI_PERAWATAN: '1UxvDvDIIbBz-zh20ld99OKBmgotY8_XeDYGHdTLkH2s', // Log Inspeksi Harian, Log Perawatan Preventif, Log Perbaikan Korektif
  LOGBOOK_FEEDBACK: '1hNFN9FRM18TwzrFbisA-cjPX49EN-x1ytB_7htP_USk',
  LOGBOOK_INSPEKSI_KEBERSIHAN: '1niuspaGx4gZjDDjYIxke_ygf1zZ0QA5bUlPRyA9SgcU',
  DATABASE_PENGHUNI: '17qdAMk02hVZ5O92zrts393Ue-RdqAS-ImZChj5P8lBY', // READ-ONLY! sheet DATA berformula/IMPORTRANGE
  INVOICE_SEWA: '10QJeO3j6mFqXJNS_4763z6Ct6-4HP6LGNP_gq4Ovyaw',
  INVOICE_DP: '1iX_5LtIpTBwnwB4-krUe_GlvIfef9MtqWfadDsosnzo',
  AUDIT_LOG: process.env.SHEET_ID_AUDIT_LOG || '',
  PINDAH_KAMAR: process.env.SHEET_ID_PINDAH_KAMAR || '',
  CHECKOUT: process.env.SHEET_ID_CHECKOUT || ''
} as const;

// Spreadsheet yang TIDAK BOLEH ditulis app (berformula / dikelola sistem lain)
export const READ_ONLY_SHEETS: string[] = [SHEETS.DATABASE_PENGHUNI];
