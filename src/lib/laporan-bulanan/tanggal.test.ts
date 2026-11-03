import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type Client } from '@libsql/client';
import { argTanggal, hariBerikut, kondisiTanggal } from './tanggal';
import { parsePeriode } from './periode';
import { ambilPekerjaan } from './builders/pekerjaan';
import { ambilKinerjaMarketing } from './builders/marketing';

const SEKARANG = new Date('2026-11-02');

test('kondisiTanggal memakai rentang setengah terbuka tanpa membungkus kolom', () => {
  assert.equal(kondisiTanggal('o.tgl'), 'o.tgl >= ? AND o.tgl < ?');
});

test('hariBerikut menangani akhir bulan, akhir tahun, dan kabisat', () => {
  assert.equal(hariBerikut('2026-06-30'), '2026-07-01');
  assert.equal(hariBerikut('2026-12-31'), '2027-01-01');
  assert.equal(hariBerikut('2028-02-28'), '2028-02-29');
  assert.equal(hariBerikut('2028-02-29'), '2028-03-01');
  assert.equal(hariBerikut('2027-02-28'), '2027-03-01');
});

test('argTanggal = [dari, hari setelah sampai]', () => {
  assert.deepEqual(argTanggal(parsePeriode('2026-06', SEKARANG)), ['2026-06-01', '2026-07-01']);
  assert.deepEqual(argTanggal(parsePeriode('2026-12', new Date('2027-01-05'))), ['2026-12-01', '2027-01-01']);
});

test('filter Juni mengambil 30 Juni 23:59 dan membuang 1 Juli 00:00', async () => {
  const db = createClient({ url: ':memory:' });
  await db.execute('CREATE TABLE daily_tasks (id INTEGER PRIMARY KEY, tanggal TEXT, task TEXT, pic TEXT, divisi TEXT, deadline TEXT, status TEXT)');
  for (const [t, tgl] of [['a', '2026-06-30 23:59'], ['b', '2026-07-01 00:00'], ['c', '2026-06-01'], ['d', '2026-05-31 23:59']]) {
    await db.execute({ sql: "INSERT INTO daily_tasks (tanggal, task, divisi, status) VALUES (?, ?, 'Admin', 'Pending')", args: [tgl, t] });
  }
  const rows = await ambilPekerjaan('Admin', parsePeriode('2026-06', SEKARANG), db);
  assert.deepEqual(rows.map(r => r.task), ['c', 'a']);
});

// Membungkus client agar kita bisa menghitung berapa baris yang benar-benar dikirim ke aplikasi.
function hitungBaris(db: Client): { db: Client; baris: () => number } {
  let n = 0;
  const bungkus = {
    execute: async (q: Parameters<Client['execute']>[0]) => {
      const r = await db.execute(q);
      n += r.rows.length;
      return r;
    },
  } as unknown as Client;
  return { db: bungkus, baris: () => n };
}

test('marketing: hanya baris dalam periode yang dikirim ke aplikasi', async () => {
  const db = createClient({ url: ':memory:' });
  await db.execute('CREATE TABLE leads (tanggal TEXT, sumber_leads TEXT, status_leads TEXT)');
  await db.execute('CREATE TABLE content (tgl_post TEXT, platform TEXT, likes INT, komentar INT, share_saves INT, reach INT)');
  await db.execute('CREATE TABLE promotion (tgl_mulai TEXT, tgl_selesai TEXT, budget INT, spend_aktual INT, target_leads INT, leads_aktual INT, booking_dr_promo INT)');
  // leads: 2 dalam Juni (termasuk 30 Juni 23:59), 3 di luar
  for (const t of ['2026-06-01', '2026-06-30 23:59', '2026-05-31', '2026-07-01', '2025-01-10']) {
    await db.execute({ sql: "INSERT INTO leads VALUES (?, 'IG', 'Baru')", args: [t] });
  }
  // content: 1 dalam, 2 di luar
  for (const t of ['2026-06-15', '2026-07-02', '2026-05-30']) {
    await db.execute({ sql: "INSERT INTO content VALUES (?, 'Instagram', 10, 2, 1, 100)", args: [t] });
  }
  // promotion: beririsan = mulai sebelum Juni & selesai di Juni, di dalam Juni, mulai Juni & belum selesai (NULL), mulai Juni & selesai '';
  // tidak beririsan = selesai sebelum Juni, mulai Juli.
  const promo: [string, string | null][] = [
    ['2026-05-20', '2026-06-05'], ['2026-06-10', '2026-06-20'], ['2026-06-25', null], ['2026-06-30', ''],
    ['2026-04-01', '2026-05-31'], ['2026-07-01', '2026-07-31'],
  ];
  for (const [m, s] of promo) {
    await db.execute({ sql: 'INSERT INTO promotion VALUES (?, ?, 100, 50, 10, 4, 1)', args: [m, s] });
  }

  const spy = hitungBaris(db);
  const d = await ambilKinerjaMarketing(parsePeriode('2026-06', SEKARANG), SEKARANG, spy.db);
  assert.equal(d.leads.total, 2);
  assert.equal(d.konten.post, 1);
  assert.equal(d.kampanye.jumlah, 4);
  // 2 leads + 1 content + 4 promotion = 7 baris dikirim; total tersimpan 5 + 3 + 6 = 14.
  assert.equal(spy.baris(), 7);
});
