import test from 'node:test';
import assert from 'node:assert/strict';
import { teksPolos, cariCacat, urai } from './cek';

test('teksPolos membuang style, script, tag dan merapikan spasi', () => {
  const html = '<style>.a{color:null}</style><script>var x=NaN</script><p>Halo  &amp; <b>dunia</b></p>\n<p>&lt;x&gt; &quot;q&quot; &#39;s&#39;</p>';
  assert.equal(teksPolos(html), 'Halo & dunia <x> "q" \'s\'');
});

test('cariCacat menemukan token cacat di teks, unik', () => {
  const html = '<td>NaN</td><td>NaN%</td><td>undefined</td><td>[object Object]</td><td>Infinity</td><td>null</td>';
  assert.deepEqual(cariCacat(html).sort(), ['Infinity', 'NaN', 'null', 'undefined', '[object'].sort());
});

test('cariCacat mengabaikan CSS, atribut, dan kata yang hanya mengandung token', () => {
  const html = '<style>.a{x:null}</style><div title="null undefined" class="NaN">Nullable Infinityx unknown</div>';
  assert.deepEqual(cariCacat(html), []);
});

test('cariCacat kosong untuk teks bersih', () => {
  assert.deepEqual(cariCacat('<p>Rp0 0%</p>'), []);
});

test('teksPolos membuang blok style dengan atribut', () => {
  assert.equal(teksPolos('<style type="text/css" media="print">.a{x:null}</style><p>ok</p>'), 'ok');
});

test('urai argumen CLI', () => {
  assert.deepEqual(urai(['semua', '2026-06']), { id: 'semua', kode: '2026-06', html: undefined, full: false });
  assert.deepEqual(urai(['semua', '2026-06', '--full']), { id: 'semua', kode: '2026-06', html: undefined, full: true });
  assert.deepEqual(urai(['--html', '/tmp/x', 'semua', '2026-06']), { id: 'semua', kode: '2026-06', html: '/tmp/x', full: false });
  assert.deepEqual(urai(['semua', '2026-06', '--html', '/tmp/x']), { id: 'semua', kode: '2026-06', html: '/tmp/x', full: false });
  assert.equal(urai(['semua']), null);
  assert.equal(urai(['semua', '2026-06', '--html']), null);
  assert.equal(urai([]), null);
});
