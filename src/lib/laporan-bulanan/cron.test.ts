import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cronDiizinkan, pilihLaporanBelumAda } from './cron';

test('pilihLaporanBelumAda membuang yang sudah ada, urutan tetap', () => {
  assert.deepEqual(pilihLaporanBelumAda(['a', 'b', 'c'], new Set(['b'])), ['a', 'c']);
});

test('pilihLaporanBelumAda: set penuh -> kosong; set kosong -> semua', () => {
  assert.deepEqual(pilihLaporanBelumAda(['a', 'b'], new Set(['a', 'b', 'x'])), []);
  assert.deepEqual(pilihLaporanBelumAda(['a', 'b'], new Set()), ['a', 'b']);
});

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
