import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createClient } from '@libsql/client';
import { bacaRekening, bacaTagihan } from './db';

/** Skema minimal yang dibaca fitur ini (lihat db/schema/000, 004, 007, 029). */
export async function dbUji() {
  const db = createClient({ url: ':memory:' });
  await db.executeMultiple(`
    CREATE TABLE active_tenant (kamar_id TEXT PRIMARY KEY, id_penghuni TEXT UNIQUE, nama_lengkap TEXT NOT NULL,
      nama_panggilan TEXT, no_kamar TEXT, no_hp TEXT);
    CREATE TABLE kamar (id_kamar TEXT PRIMARY KEY, no_kamar INTEGER, tipe_kamar TEXT);
    CREATE TABLE invoice_sewa (id INTEGER PRIMARY KEY AUTOINCREMENT, id_penghuni TEXT, tanggal_pembayaran TEXT,
      periode_akhir TEXT, jumlah_bulan INTEGER, tipe_kamar TEXT, void_pada TEXT);
    CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_by TEXT,
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP));
  `);
  await db.executeMultiple(fs.readFileSync('db/schema/039_pengingat_tagihan.sql', 'utf8'));
  return db;
}

type Db = Awaited<ReturnType<typeof dbUji>>;

async function penghuni(db: Db, n: number, tipe: string | null = 'Eco') {
  await db.execute({ sql: 'INSERT INTO kamar VALUES (?,?,?)', args: [`K${n}`, n, tipe] });
  await db.execute({
    sql: 'INSERT INTO active_tenant VALUES (?,?,?,?,?,?)',
    args: [`K${n}`, `P${n}`, `Nama ${n}`, null, String(n), '08521234567']
  });
}

const invoice = (db: Db, id: string, akhir: string, o: { bayar?: string | null; void?: string; bulan?: number } = {}) =>
  db.execute({
    sql: 'INSERT INTO invoice_sewa (id_penghuni, tanggal_pembayaran, periode_akhir, jumlah_bulan, tipe_kamar, void_pada) VALUES (?,?,?,?,?,?)',
    args: [id, o.bayar === undefined ? '2026-11-01' : o.bayar, akhir, o.bulan ?? 1, 'Classic', o.void ?? null]
  });

test('jatuh tempo = periode_akhir terakhir yang dibayar dan tidak void', async () => {
  const db = await dbUji();
  await penghuni(db, 1);
  await invoice(db, 'P1', '2026-11-30');
  await invoice(db, 'P1', '2026-10-31');
  await invoice(db, 'P1', '2026-12-30', { void: '2026-11-02' });
  await invoice(db, 'P1', '2027-01-30', { bayar: null });
  await invoice(db, 'P1', '2027-02-28', { bayar: '' });
  const [b, ...lain] = await bacaTagihan(db);
  assert.equal(lain.length, 0);
  assert.deepEqual(b, {
    idPenghuni: 'P1', nama: 'Nama 1', panggilan: '', noKamar: '1', tipe: 'Eco', noHp: '08521234567',
    jatuhTempo: '2026-11-30', bulan: 1
  });
});

test('tanpa invoice dan penghuni check-out tidak muncul', async () => {
  const db = await dbUji();
  await penghuni(db, 1);
  await invoice(db, 'SUDAH-KELUAR', '2026-11-30');
  assert.deepEqual(await bacaTagihan(db), []);
});

test('tanggal sama: id terbesar; jam dipotong; teks bebas dilewati; tipe jatuh ke invoice', async () => {
  const db = await dbUji();
  await penghuni(db, 1, null);
  await penghuni(db, 2);
  await invoice(db, 'P1', '2026-11-30', { bulan: 1 });
  await invoice(db, 'P1', '2026-11-30 00:00:00', { bulan: 3 });
  await invoice(db, 'P2', 'akhir bulan');
  const hasil = await bacaTagihan(db);
  assert.deepEqual(hasil.map((b) => [b.idPenghuni, b.jatuhTempo, b.bulan, b.tipe]), [['P1', '2026-11-30', 3, 'Classic']]);
});

test('migrasi: rekening awal terisi dan tidak menimpa perubahan', async () => {
  const db = await dbUji();
  assert.deepEqual((await bacaRekening(db)).rekening, { bank: 'BRI', nomor: '0892-0102-1802-537', atasNama: 'Dwi Antari K A Roem' });
  await db.execute("UPDATE app_config SET value = 'rusak' WHERE key = 'rekening_pembayaran'");
  await db.executeMultiple(fs.readFileSync('db/schema/039_pengingat_tagihan.sql', 'utf8'));
  assert.equal((await bacaRekening(db)).rekening, null);
});
