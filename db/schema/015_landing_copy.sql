-- Teks statis halaman landing (heading section, label tombol) yang bisa diedit
-- dari Mini App. Key mengikuti DEFAULT_COPY di repo landing (lib/copy.ts).
CREATE TABLE IF NOT EXISTS landing_copy (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  updated_by  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
