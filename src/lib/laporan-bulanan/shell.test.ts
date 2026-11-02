import test from 'node:test';
import assert from 'node:assert/strict';
import { kerangkaDokumen } from './shell';

test('kerangka dokumen', () => {
  const h = kerangkaDokumen('<p>ISI-UJI</p>', 'dokumen');
  assert.ok(h.startsWith('<!DOCTYPE html>'));
  assert.ok(h.includes('<p>ISI-UJI</p>'));
  assert.ok(/@page\s*\{[^}]*A4/.test(h));
  assert.ok(h.includes('#d9e2f3'));
  assert.ok(!h.includes('#9e2227'));
});
test('tema owner', () => {
  const h = kerangkaDokumen('<p>x</p>', 'owner');
  assert.ok(h.includes('#9e2227'));
  assert.ok(h.includes('Poppins'));
  assert.ok(!h.includes('#d9e2f3'));
});
test('tema kinerja: sel 9pt tanpa latar header', () => {
  const h = kerangkaDokumen('<p>x</p>', 'kinerja');
  assert.ok(h.includes('font-size: 9pt'));
  assert.ok(!h.includes('#d9e2f3'));
  assert.ok(!h.includes('#9e2227'));
});
