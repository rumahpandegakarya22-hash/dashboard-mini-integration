-- Beban langganan digabung satu akun: workspace, AI, sewa domain/hosting, software lain.
-- Dipakai bersama fitur Beban Dimuka (bayar paket beberapa bulan, diamortisasi per bulan).
INSERT OR IGNORE INTO coa (kode, nama_akun, tipe_akun, saldo_normal, kategori_arus_kas, grup_laporan) VALUES
  (5130, 'Langganan Software & Cloud', 'Beban', 'Debit', 'Operasional', 'Beban Operasional');
