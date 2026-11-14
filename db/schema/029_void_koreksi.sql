-- Void dan koreksi (pengganti edit-di-tempat untuk jurnal dan pembayaran).
-- Void = baris pembalik (debit/kredit ditukar), bukan hapus. Koreksi = void + transaksi baru.

-- Jurnal. grup_id mengelompokkan baris satu transaksi (NULL untuk data lama).
-- void_dari: pada baris pembalik, id baris yang dibalik.
-- dibalik_oleh: pada baris asli, id baris pembalik.
-- koreksi_dari: pada transaksi koreksi, grup_id asal.
ALTER TABLE jurnal_transaksi ADD COLUMN grup_id TEXT;
ALTER TABLE jurnal_transaksi ADD COLUMN void_dari INTEGER;
ALTER TABLE jurnal_transaksi ADD COLUMN dibalik_oleh INTEGER;
ALTER TABLE jurnal_transaksi ADD COLUMN koreksi_dari TEXT;
CREATE INDEX IF NOT EXISTS idx_jurnal_grup ON jurnal_transaksi (grup_id);

-- Invoice sewa dan DP. koreksi_dari berisi no_inv asal.
ALTER TABLE invoice_sewa ADD COLUMN void_pada TEXT;
ALTER TABLE invoice_sewa ADD COLUMN void_oleh TEXT;
ALTER TABLE invoice_sewa ADD COLUMN void_alasan TEXT;
ALTER TABLE invoice_sewa ADD COLUMN koreksi_dari TEXT;
ALTER TABLE invoice_dp ADD COLUMN void_pada TEXT;
ALTER TABLE invoice_dp ADD COLUMN void_oleh TEXT;
ALTER TABLE invoice_dp ADD COLUMN void_alasan TEXT;
ALTER TABLE invoice_dp ADD COLUMN koreksi_dari TEXT;
