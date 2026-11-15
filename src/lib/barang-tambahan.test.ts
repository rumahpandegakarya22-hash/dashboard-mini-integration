import test from 'node:test';
import assert from 'node:assert/strict';
import { rapikanBarang } from './barang-tambahan';

test('rapikan: spasi, entri kosong, dan duplikat dibuang', () => {
  assert.equal(rapikanBarang('  Kulkas ,rice   cooker,, kulkas , Hair Dryer '), 'Kulkas, rice cooker, Hair Dryer');
  assert.equal(rapikanBarang('kulkas'), 'kulkas');
});

test('rapikan: kosong/null jadi string kosong', () => {
  assert.equal(rapikanBarang(''), '');
  assert.equal(rapikanBarang(null), '');
  assert.equal(rapikanBarang(' , ,'), '');
});
