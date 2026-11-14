-- Kepuasan penghuni (skor 1-5 per penghuni per bulan), diinput Admin and Finance.
CREATE TABLE IF NOT EXISTS csat_response (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  id_penghuni  TEXT NOT NULL REFERENCES occupancy_history (id_penghuni),
  periode      TEXT NOT NULL,
  skor         INTEGER NOT NULL CHECK (skor BETWEEN 1 AND 5),
  komentar     TEXT,
  dicatat_oleh TEXT,
  created_at   TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (id_penghuni, periode)
);

-- Jenis dokumen wajib penghuni (nilai harus sama dengan tenant_docs.doc_type). Bisa diubah di tabel settings.
INSERT OR IGNORE INTO settings (grup, kolom, nilai, urutan) VALUES
  ('DOKUMEN_WAJIB', 'Jenis', 'KTP', 1),
  ('DOKUMEN_WAJIB', 'Jenis', 'Surat Kontrak', 2);
