import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { kondisiTanggal } from './tanggal';
import { parsePeriode } from './periode';
import { ambilPekerjaan } from './builders/pekerjaan';

test('kondisiTanggal memotong 10 karakter pertama', () => {
  assert.equal(kondisiTanggal('o.tgl'), 'substr(o.tgl, 1, 10) BETWEEN ? AND ?');
});

test('filter Juni mengambil 30 Juni 23:59 dan membuang 1 Juli 00:00', async () => {
  const db = createClient({ url: ':memory:' });
  await db.execute('CREATE TABLE daily_tasks (id INTEGER PRIMARY KEY, tanggal TEXT, task TEXT, pic TEXT, divisi TEXT, deadline TEXT, status TEXT)');
  for (const [t, tgl] of [['a', '2026-06-30 23:59'], ['b', '2026-07-01 00:00'], ['c', '2026-06-01'], ['d', '2026-05-31 23:59']]) {
    await db.execute({ sql: "INSERT INTO daily_tasks (tanggal, task, divisi, status) VALUES (?, ?, 'Admin', 'Pending')", args: [tgl, t] });
  }
  const p = parsePeriode('2026-06', new Date('2026-11-02'));
  const rows = await ambilPekerjaan('Admin', p, db);
  assert.deepEqual(rows.map(r => r.task), ['c', 'a']);
});
