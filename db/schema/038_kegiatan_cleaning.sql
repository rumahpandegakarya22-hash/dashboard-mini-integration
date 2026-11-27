-- Kegiatan harian Cleaning: satu baris per hari-input, banyak foto bertanda jenis kegiatan.
-- Foto diambil langsung dari kamera Mini App (berstempel WIB + nama) lalu disimpan ke Drive.
CREATE TABLE IF NOT EXISTS kegiatan_cleaning (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal     TEXT NOT NULL,
  petugas     TEXT NOT NULL,
  catatan     TEXT,
  dibuat_oleh TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS kegiatan_cleaning_foto (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kegiatan_id INTEGER NOT NULL REFERENCES kegiatan_cleaning(id) ON DELETE CASCADE,
  jenis       TEXT NOT NULL,
  link_drive  TEXT NOT NULL,
  urutan      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kegiatan_cleaning_tanggal ON kegiatan_cleaning (tanggal);
CREATE INDEX IF NOT EXISTS idx_kegiatan_cleaning_foto_kegiatan ON kegiatan_cleaning_foto (kegiatan_id);
