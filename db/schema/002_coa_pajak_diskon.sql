-- Akun untuk pajak & diskon pada pembayaran sewa/DP (4 Agustus 2026).
--
-- Sebelum ini, submit dengan diskon/pajak sengaja TIDAK menghasilkan jurnal:
-- uang yang diterima (grand total) tidak sama dengan jumlah baris pengakuan
-- (subtotal), sehingga selisihnya akan mengendap di akun 2105 tanpa ketahuan.
-- Tiga akun di bawah menutup selisih itu.
--
-- Hutang Pajak = pajak yang DIPUNGUT dari penghuni untuk disetor ke negara.
-- Itu kewajiban, bukan pendapatan — kalau dikreditkan ke 4101, pendapatan
-- tercatat lebih besar dari yang sebenarnya.
--
-- Beban Pajak dipakai untuk pajak yang memang biaya sendiri (mis. PBB), lewat
-- modul Pengeluaran. Penyetoran Hutang Pajak ke negara TIDAK memakai akun ini —
-- itu Debit 2106 / Kredit kas, juga lewat modul Pengeluaran (Tipe Akun: Liabilitas).
--
-- Diskon dibukukan sebagai Beban, bukan pengurang Pendapatan Sewa, supaya
-- totalnya bisa dijumlah dan ditampilkan sebagai angka tersendiri di dashboard.
-- Konsekuensi yang disengaja: Pendapatan Sewa tetap tercatat penuh sesuai tarif,
-- diskonnya muncul di sisi beban.

INSERT OR IGNORE INTO coa (kode, nama_akun, tipe_akun, saldo_normal, kategori_arus_kas, grup_laporan) VALUES
  (2106, 'Hutang Pajak', 'Liabilitas', 'Kredit', 'Operasional', 'Hutang'),
  (5128, 'Beban Pajak',  'Beban',      'Debit',  'Operasional', 'Beban Operasional'),
  (5129, 'Beban Diskon', 'Beban',      'Debit',  'Operasional', 'Beban Operasional');
