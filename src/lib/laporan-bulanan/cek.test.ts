import test from 'node:test';
import assert from 'node:assert/strict';
import { teksPolos, cariCacat } from './cek';

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
