import type { Client } from '@libsql/client';

/* Tabel kegiatan Cleaning dibuat sendiri oleh aplikasi saat pertama dipakai (idempoten), jadi deploy
   tidak butuh migrasi manual. Isinya SAMA dengan db/schema/038_kegiatan_cleaning.sql (dijaga test). */

export const DDL_KEGIATAN_CLEANING = [
  `CREATE TABLE IF NOT EXISTS kegiatan_cleaning (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal     TEXT NOT NULL,
  petugas     TEXT NOT NULL,
  catatan     TEXT,
  dibuat_oleh TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
)`,
  `CREATE TABLE IF NOT EXISTS kegiatan_cleaning_foto (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kegiatan_id INTEGER NOT NULL REFERENCES kegiatan_cleaning(id) ON DELETE CASCADE,
  jenis       TEXT NOT NULL,
  link_drive  TEXT NOT NULL,
  urutan      INTEGER NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_kegiatan_cleaning_tanggal ON kegiatan_cleaning (tanggal)`,
  `CREATE INDEX IF NOT EXISTS idx_kegiatan_cleaning_foto_kegiatan ON kegiatan_cleaning_foto (kegiatan_id)`
];

const sudah = new WeakMap<Client, Promise<void>>();

/** Buat tabel bila belum ada. Dijalankan sekali per proses. */
export function pastikanSkemaKegiatanCleaning(db: Client): Promise<void> {
  let p = sudah.get(db);
  if (!p) {
    p = (async () => {
      for (const ddl of DDL_KEGIATAN_CLEANING) await db.execute(ddl);
    })().catch((e) => {
      sudah.delete(db); // gagal → coba lagi pada pemanggilan berikutnya
      throw e;
    });
    sudah.set(db, p);
  }
  return p;
}
