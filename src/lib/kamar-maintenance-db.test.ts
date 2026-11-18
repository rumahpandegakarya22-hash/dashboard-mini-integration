import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type Client } from '@libsql/client';
import { bukaMaintenance, tutupMaintenance, tutupMaintenanceKamar, selaraskanStatus, selaraskanSemua } from './kamar-maintenance-db';
import { DDL_KAMAR_MAINTENANCE, pastikanSkemaKamar } from './kamar-maintenance-skema';
import { readFileSync } from 'node:fs';

async function dbUji(): Promise<Client> {
  const db = createClient({ url: ':memory:' });
  await db.execute('CREATE TABLE kamar (no_kamar INTEGER PRIMARY KEY, status TEXT)');
  await db.execute('CREATE TABLE active_tenant (kamar_id TEXT PRIMARY KEY, no_kamar TEXT)');
  await db.execute('CREATE TABLE work_orders (id INTEGER PRIMARY KEY)');
  await db.execute('CREATE TABLE booking (no_booking TEXT PRIMARY KEY, kamar_no INTEGER, status_booking TEXT)');
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

test('Booking → Maintenance → kembali Booking; booking batal/check-in tidak menahan kamar', async () => {
  const db = await dbUji();
  await db.execute("INSERT INTO booking VALUES ('BK-1', 6, 'Konfirmasi')");
  assert.equal(await selaraskanStatus(db, '6'), 'Booking');
  assert.equal(await bukaMaintenance(db, { noKamar: '6', sumber: 'manual', alasan: 'Cat ulang' }), 'Maintenance');
  assert.equal(await tutupMaintenanceKamar(db, { noKamar: '6' }), 'Booking');
  await db.execute("UPDATE booking SET status_booking = 'Dibatalkan'");
  assert.equal(await selaraskanStatus(db, '6'), 'Kosong');
  await db.execute("UPDATE booking SET status_booking = 'Pending'");
  assert.equal(await selaraskanStatus(db, '6'), 'Booking');
  await db.execute("UPDATE booking SET status_booking = 'Check-in'");
  assert.equal(await selaraskanStatus(db, '6'), 'Kosong');
});

test('penghuni aktif menang atas booking berikutnya', async () => {
  const db = await dbUji();
  await db.execute("INSERT INTO booking VALUES ('BK-2', 5, 'Pending')");
  assert.equal(await selaraskanStatus(db, '5'), 'Terisi');
});

test('skema dibuat otomatis (idempoten) dan sama dengan file migrasi 036', async () => {
  const db = createClient({ url: ':memory:' });
  await db.execute('CREATE TABLE work_orders (id INTEGER PRIMARY KEY)');
  await pastikanSkemaKamar(db);
  await pastikanSkemaKamar(db);
  await db.execute("INSERT INTO kamar_maintenance (no_kamar, sumber) VALUES ('5', 'manual')");
  const kolom = (await db.execute('PRAGMA table_info(work_orders)')).rows.map((r) => String(r.name));
  assert.ok(kolom.includes('no_kamar'));

  const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
  const file = norm(readFileSync(new URL('../../db/schema/036_kamar_maintenance.sql', import.meta.url), 'utf8').replace(/^\s*--.*$/gm, ''));
  for (const ddl of DDL_KAMAR_MAINTENANCE) assert.ok(file.includes(norm(ddl)), `DDL tidak sama dengan file 036: ${ddl.slice(0, 60)}`);
});

test('selaraskanSemua: pratinjau tidak menulis; Maintenance tanpa pemicu dilewati', async () => {
  const db = await dbUji();
  await db.execute("INSERT INTO kamar VALUES (7, 'Kosong'), (8, 'Maintenance')");
  await db.execute("INSERT INTO booking VALUES ('BK-9', 7, 'Konfirmasi')");
  const pratinjau = await selaraskanSemua(db, false);
  assert.deepEqual(pratinjau.perubahan, [{ no: '7', dari: 'Kosong', ke: 'Booking' }]);
  assert.deepEqual(pratinjau.dilewati, ['8']);
  assert.equal(await status(db, 7), 'Kosong');
  await selaraskanSemua(db, true);
  assert.equal(await status(db, 7), 'Booking');
  assert.equal(await status(db, 8), 'Maintenance');
});
