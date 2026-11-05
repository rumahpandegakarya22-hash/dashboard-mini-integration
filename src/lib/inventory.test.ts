import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { konsumsiFifo } from './inventory';

async function db() {
  const c = createClient({ url: ':memory:' });
  await c.execute(`CREATE TABLE purchase_batches (id INTEGER PRIMARY KEY, material_id INT, purchase_date INT, remaining_qty REAL, price_per_unit REAL)`);
  await c.execute(`INSERT INTO purchase_batches VALUES (1,7,100,5,1000),(2,7,200,10,2000),(3,8,50,9,9999)`);
  return c;
}

test('FIFO mengalir ke batch berikutnya dan biaya = jumlah per batch', async () => {
  const c = await db();
  const r = await konsumsiFifo(c, 7, 8);
  assert.equal(r.totalCost, 5 * 1000 + 3 * 2000);
  assert.equal(r.batchId, 1);
  const sisa = (await c.execute('SELECT id, remaining_qty FROM purchase_batches WHERE material_id = 7 ORDER BY id')).rows.map((x) => Number(x.remaining_qty));
  assert.deepEqual(sisa, [0, 7]);
});

test('batch pilihan dipakai lebih dulu dan tidak menyentuh bahan lain', async () => {
  const c = await db();
  const r = await konsumsiFifo(c, 7, 4, 2);
  assert.equal(r.totalCost, 8000);
  assert.equal(r.batchId, 2);
  const lain = await c.execute('SELECT remaining_qty FROM purchase_batches WHERE id = 3');
  assert.equal(Number(lain.rows[0].remaining_qty), 9);
});

test('tanpa batch: biaya null', async () => {
  const c = await db();
  const r = await konsumsiFifo(c, 99, 3);
  assert.deepEqual(r, { batchId: null, unitPrice: null, totalCost: null });
});
