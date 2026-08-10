-- Tambah kolom harga_2bulan ke tabel kamar.
-- Nilai awal diisi dari harga_3bulan (logika sebelumnya: 2 bln = rate 3 bln).
ALTER TABLE kamar ADD COLUMN harga_2bulan INTEGER NOT NULL DEFAULT 0;
UPDATE kamar SET harga_2bulan = harga_3bulan WHERE harga_2bulan = 0;
