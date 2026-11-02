-- laporan_riwayat.jenis tadinya dibatasi CHECK ('Cashflow','LabaRugi','Neraca'); laporan bulanan memakai id registri.
-- SQLite tidak bisa mengubah CHECK, jadi tabel dibuat ulang tanpa CHECK. Aman dijalankan ulang selama tabel lama belum di-drop.
CREATE TABLE IF NOT EXISTS laporan_riwayat_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  periode      TEXT NOT NULL,
  jenis        TEXT NOT NULL,
  nama_file    TEXT NOT NULL,
  drive_url    TEXT,
  dibuat_oleh  TEXT,
  created_at   TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
INSERT OR IGNORE INTO laporan_riwayat_new (id, periode, jenis, nama_file, drive_url, dibuat_oleh, created_at)
  SELECT id, periode, jenis, nama_file, drive_url, dibuat_oleh, created_at FROM laporan_riwayat;
DROP TABLE laporan_riwayat;
ALTER TABLE laporan_riwayat_new RENAME TO laporan_riwayat;
CREATE INDEX IF NOT EXISTS idx_laporan_riwayat_jenis_periode ON laporan_riwayat (jenis, periode);
