-- Foto per NOMOR kamar fisik (kamar.no_kamar 1..29) untuk landing page.
-- Berbeda dari landing_room_photos (yang per TIPE kamar A/B/C di landing_rooms).
CREATE TABLE IF NOT EXISTS landing_kamar_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  no_kamar    INTEGER NOT NULL,
  url         TEXT NOT NULL,
  alt         TEXT,
  "order"     INTEGER NOT NULL DEFAULT 0,
  is_cover    INTEGER NOT NULL DEFAULT 0,   -- 1 = foto cover untuk nomor kamar itu
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_landing_kamar_photos ON landing_kamar_photos (no_kamar);
