-- laporan_riwayat.jenis tadinya dibatasi CHECK ('Cashflow','LabaRugi','Neraca'); laporan bulanan memakai id registri.
-- SQLite tidak bisa mengubah CHECK, jadi tabel dibuat ulang tanpa CHECK. Migrasi ini NON-DESTRUKTIF (tanpa DROP):
-- apply-schema.ts lanjut ke statement berikutnya walau satu gagal, jadi tabel lama hanya di-rename sebagai cadangan.
-- laporan_riwayat_lama adalah cadangan; boleh di-DROP MANUAL setelah COUNT(*) kedua tabel sama.
-- Aman diulang: RENAME kedua gagal (sudah ada _lama), CREATE IF NOT EXISTS dilewati, INSERT OR IGNORE melengkapi.
ALTER TABLE laporan_riwayat RENAME TO laporan_riwayat_lama;
CREATE TABLE IF NOT EXISTS laporan_riwayat (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  periode      TEXT NOT NULL,
  jenis        TEXT NOT NULL,
  nama_file    TEXT NOT NULL,
  drive_url    TEXT,
  dibuat_oleh  TEXT,
  created_at   TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
INSERT OR IGNORE INTO laporan_riwayat (id, periode, jenis, nama_file, drive_url, dibuat_oleh, created_at)
  SELECT id, periode, jenis, nama_file, drive_url, dibuat_oleh, created_at FROM laporan_riwayat_lama;
CREATE INDEX IF NOT EXISTS idx_laporan_riwayat_jenis_periode ON laporan_riwayat (jenis, periode);
