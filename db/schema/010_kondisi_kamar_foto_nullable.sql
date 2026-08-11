-- Jadikan item_no nullable: foto umum kamar (item_no NULL) dan per-item (1-26)
-- Task 4 menyimpan foto umum dengan item_no=1 sebagai workaround; migrasi ini memperbaiki schema
CREATE TABLE IF NOT EXISTS kondisi_kamar_foto_new (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  kondisi_kamar_id INTEGER NOT NULL REFERENCES kondisi_kamar(id) ON DELETE CASCADE,
  fase             TEXT NOT NULL CHECK (fase IN ('awal','akhir')),
  item_no          INTEGER CHECK (item_no IS NULL OR (item_no BETWEEN 1 AND 26)),
  url              TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

INSERT INTO kondisi_kamar_foto_new (id, kondisi_kamar_id, fase, item_no, url, created_at)
SELECT id, kondisi_kamar_id, fase,
       CASE WHEN item_no = 1 THEN NULL ELSE item_no END,
       url, created_at
FROM kondisi_kamar_foto;

DROP TABLE kondisi_kamar_foto;
ALTER TABLE kondisi_kamar_foto_new RENAME TO kondisi_kamar_foto;

CREATE INDEX IF NOT EXISTS idx_kkfoto_kondisi ON kondisi_kamar_foto(kondisi_kamar_id);
