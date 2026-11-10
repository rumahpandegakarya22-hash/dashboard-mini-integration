import test from 'node:test';
import assert from 'node:assert/strict';
import { galatNopol, namaKendaraanBersih, normalisasiNopol } from './kendaraan';

test('normalisasi: huruf besar, spasi tunggal, tanpa tanda baca', () => {
  assert.equal(normalisasiNopol('ab1234cd'), 'AB 1234 CD');
  assert.equal(normalisasiNopol('  ab   1234-cd '), 'AB 1234 CD');
  assert.equal(normalisasiNopol(null), '');
});

test('validasi format nopol', () => {
  assert.equal(galatNopol(''), null);
  assert.equal(galatNopol('AB 1234 CD'), null);
  assert.equal(galatNopol('B 123 XYZ'), null);
  assert.equal(galatNopol('AB 1234'), null);
  assert.ok(galatNopol('12345'));
  assert.ok(galatNopol('HELLO'));
});

test('nama kendaraan dirapikan', () => {
  assert.equal(namaKendaraanBersih('  Honda   Beat  2020 '), 'Honda Beat 2020');
});
