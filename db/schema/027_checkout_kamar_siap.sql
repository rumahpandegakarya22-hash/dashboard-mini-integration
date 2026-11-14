-- Kesiapan kamar = kamar_siap_pada - tanggal_checkout (hari). Diisi Operasional saat kamar siap disewa.
ALTER TABLE checkout_log ADD COLUMN kamar_siap_pada TEXT;
ALTER TABLE checkout_log ADD COLUMN kamar_siap_oleh TEXT;
