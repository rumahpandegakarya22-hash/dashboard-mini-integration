import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtRentang, fmtTanggal, fmtWaktu } from './format-tanggal';

test('ISO tanggal -> DD MMM YYYY, hari dua digit', () => {
  assert.equal(fmtTanggal('2026-09-26'), '26 Sep 2026');
  assert.equal(fmtTanggal('2026-07-06'), '06 Jul 2026');
  assert.equal(fmtTanggal('2026-08-17'), '17 Agu 2026');
  assert.equal(fmtTanggal('2026-05-01'), '01 Mei 2026');
});

test('tanggal tanpa zona tidak digeser', () => {
  assert.equal(fmtTanggal('2026-12-31 23:30'), '31 Des 2026');
});

test('string ber-zona dan epoch dikonversi ke WIB', () => {
  assert.equal(fmtTanggal('2026-12-31T20:00:00Z'), '01 Jan 2027');
  assert.equal(fmtTanggal(Date.UTC(2026, 11, 31, 20, 0, 0)), '01 Jan 2027');
  assert.equal(fmtTanggal(Math.floor(Date.UTC(2026, 11, 31, 20, 0, 0) / 1000)), '01 Jan 2027');
});

test('kosong dan teks bebas', () => {
  assert.equal(fmtTanggal(null), '-');
  assert.equal(fmtTanggal(''), '-');
  assert.equal(fmtTanggal(undefined, '—'), '—');
  assert.equal(fmtTanggal('Segera'), 'Segera');
});

test('fmtWaktu: SQLite created_at dianggap UTC lalu WIB', () => {
  assert.equal(fmtWaktu('2026-08-09 10:17:10'), '09 Agu 2026 17:17');
  assert.equal(fmtWaktu('2026-08-09 20:00:00'), '10 Agu 2026 03:00');
});

test('rentang', () => {
  assert.equal(fmtRentang('2026-04-15', '2026-06-15'), '15 Apr 2026 – 15 Jun 2026');
});
