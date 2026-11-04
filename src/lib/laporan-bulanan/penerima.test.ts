import test from 'node:test';
import assert from 'node:assert/strict';
import { penerimaDariConfig, uraiPenerima } from './penerima';

test('uraiPenerima: pisah koma/spasi/baris baru, huruf kecil, tanpa duplikat', () => {
  const r = uraiPenerima('A@x.id, b@x.id;\nA@X.id  c@x.id');
  assert.deepEqual(r.valid, ['a@x.id', 'b@x.id', 'c@x.id']);
  assert.deepEqual(r.salah, []);
});

test('uraiPenerima: alamat rusak dipisahkan, array diterima', () => {
  const r = uraiPenerima(['ok@x.id', 'tanpa-at', 'a@b']);
  assert.deepEqual(r.valid, ['ok@x.id']);
  assert.deepEqual(r.salah, ['tanpa-at', 'a@b']);
});

test('penerimaDariConfig: nilai lama satu alamat, kosong, dan null', () => {
  assert.deepEqual(penerimaDariConfig('pemilik@contoh.id'), ['pemilik@contoh.id']);
  assert.deepEqual(penerimaDariConfig(''), []);
  assert.deepEqual(penerimaDariConfig(null), []);
});
