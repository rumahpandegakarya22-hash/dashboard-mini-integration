import test from 'node:test';
import assert from 'node:assert/strict';
import { bypassDevAktif } from './dev-bypass';

const dev = { NODE_ENV: 'development', DEV_BYPASS_AUTH: '1' };

test('aktif hanya saat next dev lokal dengan DEV_BYPASS_AUTH=1', () => {
  assert.equal(bypassDevAktif(dev), true);
});

test('mati bila DEV_BYPASS_AUTH tidak persis "1"', () => {
  for (const v of [undefined, '', '0', 'true', 'yes', ' 1', '1 ']) {
    assert.equal(bypassDevAktif({ ...dev, DEV_BYPASS_AUTH: v }), false, String(v));
  }
});

test('mati di production, test, atau NODE_ENV kosong', () => {
  for (const v of ['production', 'test', '', undefined]) {
    assert.equal(bypassDevAktif({ ...dev, NODE_ENV: v }), false, String(v));
  }
});

test('mati di semua lingkungan Vercel walau NODE_ENV=development dan flag menyala', () => {
  assert.equal(bypassDevAktif({ ...dev, VERCEL: '1' }), false);
  assert.equal(bypassDevAktif({ ...dev, VERCEL_ENV: 'development' }), false);
  assert.equal(bypassDevAktif({ ...dev, VERCEL_ENV: 'production' }), false);
  assert.equal(bypassDevAktif({ ...dev, VERCEL_ENV: 'preview' }), false);
});

test('mati di CI', () => {
  assert.equal(bypassDevAktif({ ...dev, CI: 'true' }), false);
  assert.equal(bypassDevAktif({ ...dev, CI: '1' }), false);
});

test('env kosong sama sekali = mati', () => {
  assert.equal(bypassDevAktif({}), false);
});
