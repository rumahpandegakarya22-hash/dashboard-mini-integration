-- Register aset tetap + log posting penyusutan (garis lurus).
-- Penyusutan/bulan = (harga_perolehan - nilai_residu) / umur_bulan.
-- Jurnal penyusutan: debit Beban Penyusutan (61xx) / kredit Akum. Penyusutan (19xx),
-- dipetakan dari kategori. Tanah TIDAK disusutkan (tidak boleh jadi kategori di sini).

CREATE TABLE IF NOT EXISTS aset_tetap (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  nama               TEXT NOT NULL,
  kategori           TEXT NOT NULL CHECK (kategori IN ('Bangunan','Elektronik','Furniture','Peralatan Operasional')),
  harga_perolehan    INTEGER NOT NULL,
  nilai_residu       INTEGER NOT NULL DEFAULT 0,
  tanggal_perolehan  TEXT NOT NULL,              -- YYYY-MM-DD
  umur_bulan         INTEGER NOT NULL,            -- masa manfaat (bulan)
  aktif              INTEGER NOT NULL DEFAULT 1,
  catatan            TEXT,
  created_at         TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Satu baris = penyusutan satu aset untuk satu bulan (idempoten via UNIQUE).
CREATE TABLE IF NOT EXISTS penyusutan_posting (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  aset_id    INTEGER NOT NULL REFERENCES aset_tetap(id) ON DELETE CASCADE,
  periode    TEXT NOT NULL,                       -- YYYY-MM
  nominal    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (aset_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_penyusutan_aset ON penyusutan_posting (aset_id);
