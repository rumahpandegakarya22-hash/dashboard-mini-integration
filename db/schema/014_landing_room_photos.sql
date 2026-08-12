-- Foto per-kamar (slideshow) + penanda cover untuk galeri.
-- landing_rooms.photo_url lama tetap dipakai sbg fallback cover bila belum ada
-- baris landing_room_photos.

CREATE TABLE IF NOT EXISTS landing_room_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id     INTEGER NOT NULL REFERENCES landing_rooms(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt         TEXT,
  "order"     INTEGER NOT NULL DEFAULT 0,
  is_cover    INTEGER NOT NULL DEFAULT 0,   -- 1 = foto cover kartu kamar
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_room_photos_room ON landing_room_photos (room_id);

-- Penanda cover galeri (foto cover jadi latar hero bila hero_photo_url kosong).
ALTER TABLE landing_gallery_photos ADD COLUMN is_cover INTEGER NOT NULL DEFAULT 0;
