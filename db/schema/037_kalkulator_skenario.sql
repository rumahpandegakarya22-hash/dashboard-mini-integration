-- Skenario Kalkulator Bisnis (khusus Owner). data = JSON SkenarioInput yang sudah lolos zod.
-- Tabel juga dibuat otomatis oleh aplikasi (src/lib/kalkulator/skema-db.ts); isinya harus sama (dijaga test).
-- Hapus = soft delete (dihapus_pada diisi) supaya tercatat di audit_log sebagai UPDATE.
CREATE TABLE IF NOT EXISTS kalkulator_skenario (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nama         TEXT NOT NULL,
  data         TEXT NOT NULL,
  versi        INTEGER NOT NULL DEFAULT 1,
  dibuat_oleh  TEXT NOT NULL,
  diubah_oleh  TEXT NOT NULL,
  dibuat_pada  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  diubah_pada  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  dihapus_pada TEXT
);

CREATE INDEX IF NOT EXISTS idx_kalkulator_aktif ON kalkulator_skenario (dihapus_pada, diubah_pada);
