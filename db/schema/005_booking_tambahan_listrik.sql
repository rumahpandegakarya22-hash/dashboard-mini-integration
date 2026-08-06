-- Tambahan listrik ikut disimpan di booking (5 Agustus 2026).
--
-- Panel Review Pendaftaran hanya mengubah status jadi 'Konfirmasi' — baris
-- occupancy_history & active_tenant belum ada saat itu (baru dibuat trigger
-- ketika status jadi 'Check-in'). Jadi nilai listrik yang diisi admin saat
-- review perlu tempat singgah, dan `booking` adalah barisnya.
ALTER TABLE booking ADD COLUMN tambahan_listrik INTEGER;
