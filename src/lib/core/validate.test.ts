import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDateTimeLocal, nowWib, selisihMenit } from './validate';

test('parseDateTimeLocal: terima T atau spasi, keluarkan spasi', () => {
  assert.equal(parseDateTimeLocal('2026-11-14T09:05'), '2026-11-14 09:05');
  assert.equal(parseDateTimeLocal('2026-11-14 09:05'), '2026-11-14 09:05');
  assert.equal(parseDateTimeLocal('2026-11-14T09:05:30'), '2026-11-14 09:05');
});

test('parseDateTimeLocal: tolak format salah, jam > 23, menit > 59, tahun liar', () => {
  for (const v of ['', '2026-11-14', '14-11-2026 09:00', '2026-11-14T24:00', '2026-11-14T09:60', '2099-01-01T00:00'])
    assert.throws(() => parseDateTimeLocal(v), /tidak valid|rentang/, v);
});

test('nowWib: pakai zona Asia/Jakarta (UTC+7), bukan UTC', () => {
  assert.equal(nowWib(new Date('2026-11-14T17:30:00Z')), '2026-11-15 00:30');
  assert.equal(nowWib(new Date('2026-11-14T00:00:00Z')), '2026-11-14 07:00');
});

test('selisihMenit: hitung menit, null untuk kosong atau urutan terbalik', () => {
  assert.equal(selisihMenit('2026-11-14 09:00', '2026-11-14 09:15'), 15);
  assert.equal(selisihMenit('2026-11-14 23:50', '2026-11-15 00:10'), 20);
  assert.equal(selisihMenit(null, '2026-11-14 09:15'), null);
  assert.equal(selisihMenit('2026-11-14 09:15', '2026-11-14 09:00'), null);
  assert.equal(selisihMenit('', ''), null);
});
