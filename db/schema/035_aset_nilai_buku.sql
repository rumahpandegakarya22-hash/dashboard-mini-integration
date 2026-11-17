-- Nilai buku tersimpan di aset dan dikurangi setiap kali penyusutan bulanan diposting.
-- Nilai awal dihitung dari harga perolehan dikurangi posting yang sudah ada.
ALTER TABLE aset_tetap ADD COLUMN nilai_buku INTEGER;
UPDATE aset_tetap SET nilai_buku = harga_perolehan - COALESCE((SELECT SUM(nominal) FROM penyusutan_posting p WHERE p.aset_id = aset_tetap.id), 0);
