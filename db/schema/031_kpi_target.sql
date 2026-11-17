-- Target KPI yang bisa diatur Owner dan kepala divisi. Tidak ada baris = pakai nilai bawaan di kode (lib/dashboard/targets.ts).
CREATE TABLE IF NOT EXISTS kpi_target (
  kunci TEXT PRIMARY KEY,
  nilai REAL NOT NULL,
  diubah_oleh TEXT,
  diubah_pada TEXT
);
