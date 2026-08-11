-- Tambah kolom deposit ke booking (nominal deposit saat pendaftaran)
-- Toleran: akan error "duplicate column" jika sudah ada; apply-schema.ts menoleransi ini
ALTER TABLE booking ADD COLUMN deposit INTEGER NOT NULL DEFAULT 0;

-- Tambah kolom refund deposit ke tr_checkout_request (data rekening tujuan refund)
ALTER TABLE tr_checkout_request ADD COLUMN no_rekening TEXT;
ALTER TABLE tr_checkout_request ADD COLUMN nama_rekening TEXT;
ALTER TABLE tr_checkout_request ADD COLUMN nama_bank TEXT;

-- Tambah kolom refund deposit ke checkout_log (dicatat saat eksekusi checkout)
ALTER TABLE checkout_log ADD COLUMN no_rekening TEXT;
ALTER TABLE checkout_log ADD COLUMN nama_rekening TEXT;
ALTER TABLE checkout_log ADD COLUMN nama_bank TEXT;
