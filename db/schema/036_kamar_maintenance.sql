-- Pemicu Maintenance per kamar. Kamar berstatus Maintenance selama masih ada baris terbuka
-- (ditutup_pada IS NULL); begitu semua tertutup, status kembali otomatis (Terisi bila ada
-- penghuni aktif, selain itu Kosong). Sumber: manual (tombol), pengaduan (Teman Rara),
-- inspeksi (kondisi akhir checkout), work_order (tujuan Maintenance). ref = id sumbernya.
CREATE TABLE IF NOT EXISTS kamar_maintenance (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  no_kamar     TEXT NOT NULL,
  sumber       TEXT NOT NULL CHECK (sumber IN ('manual', 'pengaduan', 'inspeksi', 'work_order')),
  ref          TEXT NOT NULL DEFAULT '',
  alasan       TEXT,
  dibuka_oleh  TEXT,
  dibuka_pada  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  ditutup_oleh TEXT,
  ditutup_pada TEXT
);

-- Satu sumber+ref hanya boleh punya satu baris terbuka per kamar (buka berulang = tidak dobel).
CREATE UNIQUE INDEX IF NOT EXISTS uq_kamar_maintenance_terbuka
  ON kamar_maintenance (no_kamar, sumber, ref) WHERE ditutup_pada IS NULL;
CREATE INDEX IF NOT EXISTS idx_kamar_maintenance_kamar ON kamar_maintenance (no_kamar, ditutup_pada);

-- Work order boleh dikaitkan ke satu kamar (kosong = area umum, tidak mengubah status kamar).
ALTER TABLE work_orders ADD COLUMN no_kamar TEXT;
