import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type Client } from '@libsql/client';
import { bukaMaintenance, tutupMaintenance, tutupMaintenanceKamar, selaraskanStatus } from './kamar-maintenance-db';
import { readFileSync } from 'node:fs';

async function dbUji(): Promise<Client> {
  const db = createClient({ url: ':memory:' });
  await db.execute('CREATE TABLE kamar (no_kamar INTEGER PRIMARY KEY, status TEXT)');
  await db.execute('CREATE TABLE active_tenant (kamar_id TEXT PRIMARY KEY, no_kamar TEXT)');
  await db.execute('CREATE TABLE work_orders (id INTEGER PRIMARY KEY)');
  const ddl = readFileSync(new URL('../../db/schema/036_kamar_maintenance.sql', import.meta.url), 'utf8');
  for (const stmt of ddl.replace(/^\s*--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean)) await db.execute(stmt);
  await db.execute("INSERT INTO kamar VALUES (5, 'Terisi'), (6, 'Kosong')");
  await db.execute("INSERT INTO active_tenant VALUES ('KTD-5', '5')");
  return db;
}
const status = async (db: Client, k: number) => String((await db.execute({ sql: 'SELECT status FROM kamar WHERE no_kamar = ?', args: [k] })).rows[0].status);

test('Terisi → Maintenance → kembali Terisi saat pemicu tertutup', async () => {
  const db = await dbUji();
  assert.equal(await bukaMaintenance(db, { noKamar: '5', sumber: 'work_order', ref: '12' }), 'Maintenance');
  assert.equal(await status(db, 5), 'Maintenance');
  assert.deepEqual(await tutupMaintenance(db, { sumber: 'work_order', ref: '12' }), ['5']);
  assert.equal(await status(db, 5), 'Terisi');
});

test('Kosong → Maintenance → kembali Kosong', async () => {
  const db = await dbUji();
  await bukaMaintenance(db, { noKamar: '6', sumber: 'manual', alasan: 'Cat ulang' });
  assert.equal(await status(db, 6), 'Maintenance');
  assert.equal(await tutupMaintenanceKamar(db, { noKamar: '6' }), 'Kosong');
});

test('dua pemicu: baru kembali setelah keduanya tertutup; buka berulang tidak dobel', async () => {
  const db = await dbUji();
  await bukaMaintenance(db, { noKamar: '5', sumber: 'pengaduan', ref: 'CMP-1' });
  await bukaMaintenance(db, { noKamar: '5', sumber: 'pengaduan', ref: 'CMP-1' });
  await bukaMaintenance(db, { noKamar: '5', sumber: 'work_order', ref: '7' });
  const n = await db.execute('SELECT COUNT(*) FROM kamar_maintenance');
  assert.equal(Number(n.rows[0][0]), 2);
  await tutupMaintenance(db, { sumber: 'pengaduan', ref: 'CMP-1' });
  assert.equal(await status(db, 5), 'Maintenance');
  await tutupMaintenance(db, { sumber: 'work_order', ref: '7' });
  assert.equal(await status(db, 5), 'Terisi');
});

test('checkout saat Maintenance: penghuni hilang, status tetap Maintenance sampai pemicu tertutup lalu Kosong', async () => {
  const db = await dbUji();
  await bukaMaintenance(db, { noKamar: '5', sumber: 'inspeksi', ref: '3' });
  await db.execute("DELETE FROM active_tenant WHERE no_kamar = '5'");
  assert.equal(await selaraskanStatus(db, '5'), 'Maintenance');
  assert.equal(await tutupMaintenanceKamar(db, { noKamar: '5', sumber: 'inspeksi' }), 'Kosong');
});

test('tutup satu sumber tidak menutup sumber lain; kamar tak dikenal melempar', async () => {
  const db = await dbUji();
  await bukaMaintenance(db, { noKamar: '5', sumber: 'inspeksi', ref: '3' });
  await bukaMaintenance(db, { noKamar: '5', sumber: 'work_order', ref: '9' });
  assert.equal(await tutupMaintenanceKamar(db, { noKamar: '5', sumber: 'inspeksi' }), 'Maintenance');
  await assert.rejects(() => bukaMaintenance(db, { noKamar: '99', sumber: 'manual' }), /tidak ditemukan/);
});
