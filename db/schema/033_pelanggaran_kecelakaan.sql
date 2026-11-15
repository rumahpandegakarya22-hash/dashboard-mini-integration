-- Logbook Pelanggaran Peraturan (penghuni) dan Kecelakaan Kerja (petugas), diinput lewat Mini App Ops
-- dan dibaca laporan Kinerja Admin. Pelanggaran menunjuk penghuni lewat occupancy_history supaya
-- nama dan kamarnya tetap terbaca setelah penghuni check-out.
CREATE TABLE IF NOT EXISTS pelanggaran_peraturan (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal      TEXT NOT NULL,
  id_penghuni  TEXT NOT NULL REFERENCES occupancy_history (id_penghuni),
  jenis        TEXT NOT NULL,
  deskripsi    TEXT NOT NULL,
  tindakan     TEXT,
  dicatat_oleh TEXT,
  created_at   TEXT DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_pelanggaran_tanggal ON pelanggaran_peraturan (tanggal);

CREATE TABLE IF NOT EXISTS kecelakaan_kerja (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal      TEXT NOT NULL,
  lokasi       TEXT NOT NULL,
  petugas      TEXT NOT NULL,
  kronologi    TEXT NOT NULL,
  tindakan     TEXT,
  dicatat_oleh TEXT,
  created_at   TEXT DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_kecelakaan_tanggal ON kecelakaan_kerja (tanggal);

-- Daftar jenis pelanggaran diatur Owner/Admin di Pengaturan > Jenis Pelanggaran. Hanya satu nilai awal supaya
-- dropdown tidak kosong; jenis lain ditambah sendiri.
INSERT OR IGNORE INTO settings (grup, kolom, nilai, urutan) VALUES ('JENIS_PELANGGARAN', 'Jenis', 'Lainnya', 1);
