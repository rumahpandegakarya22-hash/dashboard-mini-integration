/* Self-check FIFO + atomicity `postUsage`/`postPurchase` (lib/inventory.ts).
   DB SQLite sementara, bukan Turso produksi. Jalankan: npx tsx scripts/inventory-usage-check.ts */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';

const file = join(mkdtempSync(join(tmpdir(), 'invchk-')), 'test.db');
process.env.INVENTORY_DATABASE_URL = `file:${file}`;
delete process.env.INVENTORY_AUTH_TOKEN;

const { postUsage, postPurchase } = await import('../src/lib/inventory');

const c = createClient({ url: process.env.INVENTORY_DATABASE_URL });
await c.batch(
  [
    `CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT, role TEXT)`,
    `CREATE TABLE materials (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, category TEXT,
       unit TEXT, current_stock REAL NOT NULL DEFAULT 0, min_stock REAL NOT NULL DEFAULT 0)`,
    `CREATE TABLE purchase_batches (id INTEGER PRIMARY KEY AUTOINCREMENT, material_id INTEGER NOT NULL
       REFERENCES materials(id), user_id TEXT NOT NULL REFERENCES users(id), purchase_date INTEGER NOT NULL,
       quantity REAL NOT NULL, remaining_qty REAL NOT NULL, total_price REAL NOT NULL,
       price_per_unit REAL NOT NULL, notes TEXT, created_at INTEGER NOT NULL)`,
    `CREATE TABLE inventory_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, material_id INTEGER NOT NULL
       REFERENCES materials(id), user_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL,
       quantity REAL NOT NULL, batch_id INTEGER REFERENCES purchase_batches(id), unit_price REAL,
       total_cost REAL, notes TEXT, created_at INTEGER NOT NULL)`,
    `CREATE TABLE activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL
       REFERENCES users(id), action TEXT NOT NULL, target_data TEXT, created_at INTEGER NOT NULL)`,
    `INSERT INTO users (id, email, name, role) VALUES ('svc-miniapp', 'svc@local', 'Service', 'STAFF')`,
    `INSERT INTO materials (name, category, unit) VALUES ('Sabun', 'Kebersihan', 'botol')`
  ],
  'write'
);

// Dua batch harga beda. FIFO wajib pakai yang TERTUA (2000), bukan termurah/terbaru.
await postPurchase({ materialId: 1, quantity: 10, totalPrice: 20000, purchaseDate: '2026-01-10', notes: 'batch lama' });
await postPurchase({ materialId: 1, quantity: 10, totalPrice: 50000, purchaseDate: '2026-06-10', notes: 'batch baru' });

const stok = async () => Number((await c.execute('SELECT current_stock FROM materials WHERE id=1')).rows[0].current_stock);
assert.equal(await stok(), 20, 'stok setelah 2 pembelian');

const u = await postUsage({ materialId: 1, quantity: 4, notes: 'uji' });
assert.equal(u.newStock, 16);
assert.equal(u.totalCost, 8000, 'FIFO: 4 × Rp2.000 dari batch tertua');
assert.equal(await stok(), 16);

const sisa = await c.execute('SELECT id, remaining_qty FROM purchase_batches ORDER BY purchase_date');
assert.equal(Number(sisa.rows[0].remaining_qty), 6, 'batch tertua berkurang');
assert.equal(Number(sisa.rows[1].remaining_qty), 10, 'batch baru utuh');

// Batch tertua habis → pemakaian berikutnya jatuh ke batch berikutnya.
await postUsage({ materialId: 1, quantity: 6, notes: 'habiskan batch lama' });
const u3 = await postUsage({ materialId: 1, quantity: 2, notes: 'lanjut batch baru' });
assert.equal(u3.totalCost, 10000, 'batch kedua @ Rp5.000');

// Gagal di tengah (bahan tidak ada) tidak boleh menyisakan tulisan apa pun.
const sebelum = (await c.execute('SELECT COUNT(*) n FROM inventory_transactions')).rows[0].n;
await assert.rejects(() => postUsage({ materialId: 999, quantity: 1, notes: 'x' }));
assert.equal((await c.execute('SELECT COUNT(*) n FROM inventory_transactions')).rows[0].n, sebelum, 'rollback bersih');

console.log('OK — FIFO, saldo, dan rollback benar.');
