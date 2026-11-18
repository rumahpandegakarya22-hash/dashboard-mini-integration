import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rencanaMasukIso } from './tambah-waiting-list';

test('rencana masuk disimpan baku YYYY-MM-DD, kosong jadi null', () => {
  assert.equal(rencanaMasukIso('2026-12-05'), '2026-12-05');
  assert.equal(rencanaMasukIso('5/12/2026'), '2026-12-05');
  assert.equal(rencanaMasukIso('  '), null);
  assert.equal(rencanaMasukIso(undefined), null);
});

test('rencana masuk yang bukan tanggal atau di luar rentang wajar ditolak', () => {
  assert.throws(() => rencanaMasukIso('segera'), /tidak valid/);
  assert.throws(() => rencanaMasukIso('2026-12-05x'), /tidak valid/);
  assert.throws(() => rencanaMasukIso('1999-01-01'), /rentang wajar/);
});
