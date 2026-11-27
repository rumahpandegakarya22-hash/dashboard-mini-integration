import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PengingatTagihan, { type KartuTagihan } from '../../components/PengingatTagihan';

const kartu: KartuTagihan = {
  id: 'P1', nama: 'Contoh', noKamar: '1', tipe: 'Eco', jatuhTempo: '20 Nov 2026', keterangan: 'Lewat 7 hari',
  nomor: '6281200000001', draft: 'halo'
};
const render = (daftar: Parameters<typeof PengingatTagihan>[0]['daftar']) =>
  renderToStaticMarkup(createElement(PengingatTagihan, { daftar }));

test('section tanpa data disembunyikan', () => {
  const html = render({ terlambat: [kartu], jatuh_tempo: [], pengingat: [] });
  assert.equal(html.match(/<section/g)?.length, 1);
  assert.match(html, /Terlambat/);
  assert.doesNotMatch(html, /Jatuh Tempo<\/h2>|Pengingat<\/h2>|Tidak ada/);
});

test('semua kosong: tidak ada yang dirender', () => {
  assert.equal(render({ terlambat: [], jatuh_tempo: [], pengingat: [] }), '');
});

test('gagal baca tetap diberi tahu, bukan disembunyikan', () => {
  assert.match(render(null), /gagal dimuat/);
});
