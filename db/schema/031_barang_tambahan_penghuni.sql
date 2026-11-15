-- Nama barang elektronik tambahan milik penghuni (multi barang, dipisah koma).
-- Ikut penghuni seperti tambahan_listrik: penghuni baru mulai kosong.
ALTER TABLE active_tenant ADD COLUMN barang_tambahan TEXT;
