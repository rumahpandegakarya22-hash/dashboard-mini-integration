-- Kendaraan penghuni: nopol + nama kendaraan, untuk menelusuri kepemilikan motor lewat nopol.
-- booking = isian saat pendaftaran; active_tenant = penghuni saat ini;
-- occupancy_history = salinan permanen supaya tetap tercatat setelah penghuni check-out.
ALTER TABLE booking ADD COLUMN nopol TEXT;
ALTER TABLE booking ADD COLUMN nama_kendaraan TEXT;
ALTER TABLE active_tenant ADD COLUMN nopol TEXT;
ALTER TABLE active_tenant ADD COLUMN nama_kendaraan TEXT;
ALTER TABLE occupancy_history ADD COLUMN nopol TEXT;
ALTER TABLE occupancy_history ADD COLUMN nama_kendaraan TEXT;
CREATE INDEX IF NOT EXISTS idx_active_tenant_nopol ON active_tenant (nopol);
CREATE INDEX IF NOT EXISTS idx_occupancy_nopol ON occupancy_history (nopol);
