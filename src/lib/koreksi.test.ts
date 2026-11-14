import test from 'node:test';
import assert from 'node:assert/strict';
import { nomorKoreksi, cekAlasan, grupBaru } from './koreksi';

test('nomorKoreksi: tambah -K1, lalu -K2 tanpa menumpuk akhiran', () => {
  assert.equal(nomorKoreksi('INV/11/TDU/07/2026', 0), 'INV/11/TDU/07/2026-K1');
  assert.equal(nomorKoreksi('INV/11/TDU/07/2026-K1', 1), 'INV/11/TDU/07/2026-K2');
});

test('cekAlasan: minimal 5 karakter setelah dipangkas', () => {
  assert.equal(cekAlasan('  salah nominal  '), 'salah nominal');
  for (const v of ['', '   ', 'abc', undefined, null]) assert.throws(() => cekAlasan(v), /minimal 5/);
});

test('grupBaru: berprefiks dan unik', () => {
  const a = grupBaru('AF');
  assert.match(a, /^AF-[0-9a-f]{8}$/);
  assert.notEqual(a, grupBaru('AF'));
});
