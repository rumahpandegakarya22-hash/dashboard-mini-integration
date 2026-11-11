-- Isian kendaraan dari form pendaftaran Teman Rara; disalin ke booking/penghuni saat check-in.
ALTER TABLE tr_pendaftaran ADD COLUMN nopol TEXT;
ALTER TABLE tr_pendaftaran ADD COLUMN nama_kendaraan TEXT;
