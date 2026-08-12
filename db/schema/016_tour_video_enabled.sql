-- Toggle aktif/nonaktif blok "Video Tur Singkat" di landing page.
-- Default 1 (aktif) supaya perilaku lama tidak berubah.
ALTER TABLE landing_properties ADD COLUMN tour_video_enabled INTEGER NOT NULL DEFAULT 1;
