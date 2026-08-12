-- Slot foto hero khusus untuk landing page (independen dari urutan galeri).
-- Sebelumnya hero memakai landing_gallery_photos baris pertama secara implisit.
-- Toleran: error "duplicate column" bila sudah ada; apply-schema.ts menoleransi.
ALTER TABLE landing_properties ADD COLUMN hero_photo_url TEXT NOT NULL DEFAULT '';
