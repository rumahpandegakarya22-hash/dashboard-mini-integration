import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { selesaikanWoBiaya } from './helpers';

async function dbUji() {
  const db = createClient({ url: ':memory:' });
  await db.execute(`CREATE TABLE work_orders (id INTEGER PRIMARY KEY, tujuan_divisi TEXT, status TEXT, completed_by TEXT, updated_at TEXT)`);
  await db.execute("INSERT INTO work_orders (id, tujuan_divisi, status) VALUES (1, 'Admin', 'Pending'), (2, 'Maintenance', 'Pending'), (3, 'Admin', 'Complete')");
  return db;
}
const status = async (db: Awaited<ReturnType<typeof dbUji>>, id: number) =>
  String((await db.execute({ sql: 'SELECT status, completed_by FROM work_orders WHERE id = ?', args: [id] })).rows[0].status);

test('pengeluaran dari Joblist Admin menutup work order dan mencatat siapa', async () => {
  const db = await dbUji();
  assert.equal(await selesaikanWoBiaya(db, 1, 'rina'), undefined);
  assert.equal(await status(db, 1), 'Complete');
  const by = (await db.execute('SELECT completed_by FROM work_orders WHERE id = 1')).rows[0].completed_by;
  assert.equal(by, 'rina');
});

test('tanpa woId tidak ada yang berubah; WO divisi lain atau yang sudah Complete memberi peringatan', async () => {
  const db = await dbUji();
  assert.equal(await selesaikanWoBiaya(db, 0, 'rina'), undefined);
  assert.match((await selesaikanWoBiaya(db, 2, 'rina')) ?? '', /tidak ditemukan/);
  assert.equal(await status(db, 2), 'Pending');
  assert.match((await selesaikanWoBiaya(db, 3, 'rina')) ?? '', /sudah Complete/);
});
