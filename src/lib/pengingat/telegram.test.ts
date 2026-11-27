import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createClient } from '@libsql/client';
import { jalankanPengingat, kirimTelegram, susunPesanTelegram } from './telegram';
import { susunDaftar, type BarisTagihan } from './tagihan';

async function dbUji(jumlah = 1, akhir = '2026-11-30') {
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
  for (let n = 1; n <= jumlah; n++) {
    await db.execute({ sql: 'INSERT INTO active_tenant VALUES (?,?,?,?,?,?)', args: [`K${n}`, `P${n}`, `Penghuni ${n}`, null, String(n), '085212345678'] });
    await db.execute({ sql: "INSERT INTO invoice_sewa (id_penghuni, tanggal_pembayaran, periode_akhir, jumlah_bulan) VALUES (?, '2026-10-30', ?, 1)", args: [`P${n}`, akhir] });
  }
  return db;
}

function pengirim() {
  const pesan: string[] = [];
  return { pesan, kirim: async (t: string) => void pesan.push(t) };
}

const URL_APP = 'https://contoh.test/ops';

test('sekali per tahap; tahap baru dikirim lagi', async () => {
  const db = await dbUji();
  const p = pengirim();
  assert.deepEqual(await jalankanPengingat(db, p.kirim, '2026-11-27', URL_APP), { terkirim: 1 });
  assert.deepEqual(await jalankanPengingat(db, p.kirim, '2026-11-28', URL_APP), { terkirim: 0 });
  await jalankanPengingat(db, p.kirim, '2026-11-30', URL_APP);
  await jalankanPengingat(db, p.kirim, '2026-12-07', URL_APP);
  await jalankanPengingat(db, p.kirim, '2026-12-20', URL_APP);
  assert.equal(p.pesan.length, 3);
  assert.match(p.pesan[0], /Pengingat<\/b>\n• Penghuni 1 — Kamar 1\n {2}Jatuh tempo 30 Nov 2026 · 3 hari lagi/);
  assert.ok(p.pesan[0].includes(URL_APP));
  assert.match(p.pesan[1], /Jatuh Tempo<\/b>/);
  assert.match(p.pesan[2], /Terlambat<\/b>/);
  for (const t of p.pesan) assert.doesNotMatch(t, /Rp|0852|6285/);
});

test('pembayaran berikutnya memulai siklus baru', async () => {
  const db = await dbUji();
  const p = pengirim();
  await jalankanPengingat(db, p.kirim, '2026-11-30', URL_APP);
  await db.execute("INSERT INTO invoice_sewa (id_penghuni, tanggal_pembayaran, periode_akhir) VALUES ('P1','2026-11-30','2026-12-30')");
  await jalankanPengingat(db, p.kirim, '2026-12-30', URL_APP);
  assert.equal(p.pesan.length, 2);
});

test('kirim gagal: klaim dilepas dan dicoba lagi', async () => {
  const db = await dbUji();
  await assert.rejects(jalankanPengingat(db, async () => { throw new Error('putus'); }, '2026-11-27', URL_APP), /putus/);
  const p = pengirim();
  assert.deepEqual(await jalankanPengingat(db, p.kirim, '2026-11-27', URL_APP), { terkirim: 1 });
});

test('dua run bersamaan hanya mengirim sekali', async () => {
  const db = await dbUji(3);
  const p = pengirim();
  await Promise.all([1, 2].map(() => jalankanPengingat(db, p.kirim, '2026-11-27', URL_APP)));
  assert.equal(p.pesan.length, 1);
});

test('tidak ada tagihan: tidak ada pesan', async () => {
  const db = await dbUji(1, '2027-03-01');
  const p = pengirim();
  assert.deepEqual(await jalankanPengingat(db, p.kirim, '2026-11-27', URL_APP), { terkirim: 0 });
  assert.equal(p.pesan.length, 0);
});

test('pesan panjang dipecah; gagal di tengah tidak mengulang pecahan yang terkirim', async () => {
  const db = await dbUji(120);
  const sampai: string[] = [];
  let ke = 0;
  await assert.rejects(
    jalankanPengingat(db, async (t) => { if (++ke === 2) throw new Error('putus'); sampai.push(t); }, '2026-11-27', URL_APP)
  );
  const p = pengirim();
  await jalankanPengingat(db, p.kirim, '2026-11-27', URL_APP);
  const semua = [...sampai, ...p.pesan];
  assert.ok(semua.length >= 2 && semua.every((t) => t.length <= 4096));
  const nama = semua.join('\n').match(/• Penghuni \d+ /g)!;
  assert.equal(nama.length, 120);
  assert.equal(new Set(nama).size, 120);
});

test('karakter HTML di-escape', () => {
  const b: BarisTagihan = {
    idPenghuni: 'P', nama: 'A <b>& B', panggilan: '', noKamar: '1', tipe: '<i>', noHp: '', jatuhTempo: '2026-11-27', bulan: 1
  };
  const [{ teks }] = susunPesanTelegram(susunDaftar([b], '2026-11-27').jatuh_tempo, URL_APP);
  assert.ok(teks.includes('A &lt;b&gt;&amp; B — Kamar 1 (&lt;i&gt;)'));
});

test('kirimTelegram melempar tanpa membocorkan token', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"ok":false}', { status: 401 }));
  await assert.rejects(kirimTelegram('123:RAHASIA', '1', 'hai'), (e: Error) => /401/.test(e.message) && !e.message.includes('RAHASIA'));
});
