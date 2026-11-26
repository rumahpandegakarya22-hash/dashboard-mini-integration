import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bacaAngka, bulan, persen, rp, rpRingkas } from './format';

test('bacaAngka: koma desimal, titik ribuan, dan titik desimal dari keyboard HP', () => {
  assert.equal(bacaAngka('1.250.000'), 1_250_000);
  assert.equal(bacaAngka('Rp850.000'), 850_000);
  assert.equal(bacaAngka('1.444'), 1444);
  assert.equal(bacaAngka('12,5'), 12.5);
  assert.equal(bacaAngka('1.250,75'), 1250.75);
  assert.equal(bacaAngka('0.5'), 0.5);
  assert.equal(bacaAngka('7.25'), 7.25);
  assert.equal(bacaAngka(''), 0);
  assert.equal(bacaAngka('abc'), 0);
});

test('format tampilan', () => {
  assert.equal(rp(null), '—');
  assert.equal(rp(-1500), '-Rp1.500');
  assert.equal(rpRingkas(15_646_910), 'Rp15,6 Jt');
  assert.equal(rpRingkas(-850_000), '-Rp850 rb');
  assert.equal(persen(0.28246), '28,2%');
  assert.equal(bulan(243), '243 bln (≈ 20,3 thn)');
  assert.equal(bulan(null), 'Tidak balik modal');
});
