-- Akun Beban Dibayar Dimuka (aset lancar). Pembayaran beban di muka didebet ke sini,
-- lalu diamortisasi per bulan ke akun beban terkait.
INSERT OR IGNORE INTO coa (kode, nama_akun, tipe_akun, saldo_normal, kategori_arus_kas, grup_laporan) VALUES
  (1170, 'Beban Dibayar Dimuka', 'Aset', 'Debit', 'Operasional', 'Beban Dibayar Dimuka');
