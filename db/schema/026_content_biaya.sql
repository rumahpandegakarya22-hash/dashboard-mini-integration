-- Biaya produksi konten (rupiah penuh), dipakai menghitung CAC:
-- (promotion.spend_aktual + content.biaya_produksi) / booking baru.
ALTER TABLE content ADD COLUMN biaya_produksi INTEGER;
