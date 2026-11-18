import type { Client } from '@libsql/client';

/* =========================================================================
   Skema Maintenance kamar dibuat sendiri oleh aplikasi saat pertama dipakai (idempoten), sehingga
   deploy tidak bergantung pada migrasi manual. Isinya SAMA dengan db/schema/036_kamar_maintenance.sql
   (dijaga test); file itu tetap menjadi dokumentasi skema dan tetap bisa dijalankan manual.
   ========================================================================= */

export const DDL_KAMAR_MAINTENANCE = [
  `CREATE TABLE IF NOT EXISTS kamar_maintenance (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  no_kamar     TEXT NOT NULL,
  sumber       TEXT NOT NULL CHECK (sumber IN ('manual', 'pengaduan', 'inspeksi', 'work_order')),
  ref          TEXT NOT NULL DEFAULT '',
  alasan       TEXT,
  dibuka_oleh  TEXT,
  dibuka_pada  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  ditutup_oleh TEXT,
  ditutup_pada TEXT
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_kamar_maintenance_terbuka
  ON kamar_maintenance (no_kamar, sumber, ref) WHERE ditutup_pada IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_kamar_maintenance_kamar ON kamar_maintenance (no_kamar, ditutup_pada)`
];

const sudah = new WeakMap<Client, Promise<void>>();

async function terapkan(db: Client): Promise<void> {
  for (const ddl of DDL_KAMAR_MAINTENANCE) await db.execute(ddl);
  const kolom = await db.execute('PRAGMA table_info(work_orders)');
  if (!kolom.rows.some((r) => String(r.name) === 'no_kamar')) {
    try {
      await db.execute('ALTER TABLE work_orders ADD COLUMN no_kamar TEXT');
    } catch (e) {
      // Dua permintaan pertama bisa berlomba; kolom yang sudah ada bukan kesalahan.
      if (!/duplicate column/i.test(e instanceof Error ? e.message : String(e))) throw e;
    }
  }
}

/** Buat tabel kamar_maintenance dan kolom work_orders.no_kamar bila belum ada. Dijalankan sekali per proses. */
export function pastikanSkemaKamar(db: Client): Promise<void> {
  let p = sudah.get(db);
  if (!p) {
    p = terapkan(db).catch((e) => {
      sudah.delete(db); // gagal → coba lagi pada pemanggilan berikutnya
      throw e;
    });
    sudah.set(db, p);
  }
  return p;
}
