import type { Client } from '@libsql/client';

/* Tabel dibuat sendiri oleh aplikasi saat pertama dipakai (idempoten), pola yang sama dengan
   kamar-maintenance-skema.ts. db/schema/037_kalkulator_skenario.sql berisi DDL yang sama (dijaga test). */

export const DDL_KALKULATOR = [
  `CREATE TABLE IF NOT EXISTS kalkulator_skenario (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nama         TEXT NOT NULL,
  data         TEXT NOT NULL,
  versi        INTEGER NOT NULL DEFAULT 1,
  dibuat_oleh  TEXT NOT NULL,
  diubah_oleh  TEXT NOT NULL,
  dibuat_pada  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  diubah_pada  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  dihapus_pada TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_kalkulator_aktif ON kalkulator_skenario (dihapus_pada, diubah_pada)`
];

const sudah = new WeakMap<Client, Promise<void>>();

/** Buat tabel kalkulator_skenario bila belum ada. Dijalankan sekali per proses. */
export function pastikanSkemaKalkulator(db: Client): Promise<void> {
  let p = sudah.get(db);
  if (!p) {
    p = (async () => {
      for (const ddl of DDL_KALKULATOR) await db.execute(ddl);
    })().catch((e) => {
      sudah.delete(db); // gagal → coba lagi pada pemanggilan berikutnya
      throw e;
    });
    sudah.set(db, p);
  }
  return p;
}
