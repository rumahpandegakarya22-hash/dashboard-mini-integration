-- Landing page kini punya database sendiri; tabel landing_* di database dashboard tidak dipakai kode mana pun.
-- Anak dulu (room_photos, kamar_photos), lalu induk.
DROP TABLE IF EXISTS landing_room_photos;
DROP TABLE IF EXISTS landing_kamar_photos;
DROP TABLE IF EXISTS landing_gallery_photos;
DROP TABLE IF EXISTS landing_facilities;
DROP TABLE IF EXISTS landing_faqs;
DROP TABLE IF EXISTS landing_highlights;
DROP TABLE IF EXISTS landing_testimonials;
DROP TABLE IF EXISTS landing_copy;
DROP TABLE IF EXISTS landing_rooms;
DROP TABLE IF EXISTS landing_properties;
