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

test('tgl: kosong, ISO, ber-jam, teks bebas ter-escape', async () => {
  const { tgl, tglMentah } = await import('./format');
  assert.equal(tgl(null), '-');
  assert.equal(tgl(undefined), '-');
  assert.equal(tgl(''), '-');
  assert.equal(tgl('2026-06-22'), '22/06/2026');
  assert.equal(tgl('2026-06-22 10:30'), '22/06/2026');
  assert.equal(tgl('Besok <pagi> & "siang"'), 'Besok &lt;pagi&gt; &amp; &quot;siang&quot;');
  assert.equal(tglMentah('Senin depan'), 'Senin depan');
  assert.ok(!tgl('minggu ini').includes('undefined'));
});

test('rfc5987 meng-encode ( ) \' * juga', async () => {
  const { rfc5987 } = await import('./format');
  assert.equal(rfc5987("Laporan Kinerja (Inspeksi & Maintenance) o'k*.pdf"), 'Laporan%20Kinerja%20%28Inspeksi%20%26%20Maintenance%29%20o%27k%2A.pdf');
});

test('waktuRiwayatWib: created_at UTC SQLite -> WIB', async () => {
  const { waktuRiwayatWib } = await import('./format');
  assert.equal(waktuRiwayatWib('2026-11-02 03:05:09'), '02/11/2026 10:05');
  assert.equal(waktuRiwayatWib('2026-10-31 20:00:00'), '01/11/2026 03:00');
  assert.equal(waktuRiwayatWib('2026-11-02T03:05:09Z'), '02/11/2026 10:05');
  assert.equal(waktuRiwayatWib('bukan tanggal'), 'bukan tanggal');
});
