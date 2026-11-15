-- Barang tambahan: booking = isian saat pendaftaran/review (penghuni belum punya baris),
-- occupancy_history = salinan permanen supaya tetap tercatat setelah check-out.
-- (active_tenant sudah ditambah di 031.)
ALTER TABLE booking ADD COLUMN barang_tambahan TEXT;
ALTER TABLE occupancy_history ADD COLUMN barang_tambahan TEXT;
