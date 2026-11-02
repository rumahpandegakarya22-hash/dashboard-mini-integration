import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cronDiizinkan, jalankanCron } from './cron';

test('cronDiizinkan: nilai benar diizinkan', () => {
  assert.equal(cronDiizinkan('Bearer rahasia-panjang', 'rahasia-panjang'), true);
});

test('cronDiizinkan: secret kosong/undefined tidak pernah mengizinkan', () => {
  assert.equal(cronDiizinkan('Bearer ', ''), false);
  assert.equal(cronDiizinkan('Bearer undefined', undefined), false);
  assert.equal(cronDiizinkan('', ''), false);
  assert.equal(cronDiizinkan(undefined, undefined), false);
});

test('cronDiizinkan: header hilang, skema salah, panjang salah, nilai salah', () => {
  assert.equal(cronDiizinkan(null, 'abc'), false);
  assert.equal(cronDiizinkan(undefined, 'abc'), false);
  assert.equal(cronDiizinkan('Basic abc', 'abc'), false);
  assert.equal(cronDiizinkan('abc', 'abc'), false);
  assert.equal(cronDiizinkan('Bearer ab', 'abc'), false);
  assert.equal(cronDiizinkan('Bearer abcd', 'abc'), false);
  assert.equal(cronDiizinkan('Bearer abd', 'abc'), false);
  assert.equal(cronDiizinkan('bearer abc', 'abc'), false);
});

const lap = (...ids: string[]) => ids.map(id => ({ id }));

test('jalankanCron: yang sudah ada dilewati, sisanya dibuat, urutan sesuai laporan', async () => {
  const dipanggil: string[] = [];
  const hasil = await jalankanCron({
    laporan: lap('a', 'b', 'c'), kode: '2026-10',
    sudahAda: async id => id === 'b',
    generate: async id => { dipanggil.push(id); },
  });
  assert.deepEqual(hasil, [
    { id: 'a', status: 'dibuat' }, { id: 'b', status: 'dilewati' }, { id: 'c', status: 'dibuat' },
  ]);
  assert.deepEqual(dipanggil, ['a', 'c']);
});

test('jalankanCron: satu gagal tidak menghentikan sisanya', async () => {
  const hasil = await jalankanCron({
    laporan: lap('a', 'b', 'c'), kode: '2026-10',
    sudahAda: async () => false,
    generate: async id => { if (id === 'b') throw new Error('Drive mati'); },
  });
  assert.deepEqual(hasil.map(h => h.status), ['dibuat', 'gagal', 'dibuat']);
  assert.equal(hasil[1].error, 'Drive mati');
});

test('jalankanCron: sudahAda melempar -> gagal untuk laporan itu saja', async () => {
  const hasil = await jalankanCron({
    laporan: lap('a', 'b'), kode: '2026-10',
    sudahAda: async id => { if (id === 'a') throw new Error('db putus'); return false; },
    generate: async () => {},
  });
  assert.deepEqual(hasil, [{ id: 'a', status: 'gagal', error: 'db putus' }, { id: 'b', status: 'dibuat' }]);
});

test('jalankanCron: pemanggilan kedua, semua sudah ada -> dilewati tanpa generate', async () => {
  const ada = new Set<string>();
  let generate = 0;
  const deps = {
    laporan: lap('a', 'b'), kode: '2026-10',
    sudahAda: async (id: string) => ada.has(id),
    generate: async (id: string) => { generate++; ada.add(id); },
  };
  await jalankanCron(deps);
  assert.equal(generate, 2);
  const kedua = await jalankanCron(deps);
  assert.equal(generate, 2);
  assert.deepEqual(kedua.map(h => h.status), ['dilewati', 'dilewati']);
});
