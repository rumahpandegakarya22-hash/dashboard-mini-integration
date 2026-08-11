CREATE TABLE IF NOT EXISTS laporan_riwayat (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  periode      TEXT NOT NULL,
  jenis        TEXT NOT NULL CHECK (jenis IN ('Cashflow', 'LabaRugi', 'Neraca')),
  nama_file    TEXT NOT NULL,
  drive_url    TEXT,
  dibuat_oleh  TEXT,
  created_at   TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
