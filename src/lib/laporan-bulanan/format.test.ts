import test from 'node:test';
import assert from 'node:assert/strict';
import { rupiah, tglPendek, tglPanjang, waktuWib, esc } from './format';

test('format angka dan tanggal', () => {
  assert.equal(rupiah(30550000), 'Rp30.550.000');
  assert.equal(rupiah(-175000), '-Rp175.000');
  assert.equal(rupiah(0), 'Rp0');
  assert.equal(tglPendek('2026-06-22'), '22/06/2026');
  assert.equal(tglPanjang('2026-06-01'), '1 Juni 2026');
  assert.equal(waktuWib(new Date('2026-07-05T10:30:00Z'), true), '05/07/2026 17:30');
  assert.equal(waktuWib(new Date('2026-07-05T10:30:00Z'), false), '05/07/2026');
});
test('esc', () => {
  assert.equal(esc('<b>"A&B"</b>'), '&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
});
