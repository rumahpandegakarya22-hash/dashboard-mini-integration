import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFINISI_TARGET, bolehUbahTarget, divisiTerlihat, persenBatas, persenCapai, targetBawaan, teksTarget } from './targets';

test('kunci target unik dan nilai bawaan terisi semua', () => {
  const kunci = DEFINISI_TARGET.map((t) => t.kunci);
  assert.equal(new Set(kunci).size, kunci.length);
  assert.equal(Object.keys(targetBawaan()).length, kunci.length);
});

test('teksTarget memformat persen, rupiah, dan batas atas', () => {
  const T = targetBawaan();
  assert.equal(teksTarget(T, 'collection_rate'), 'Target 100 %');
  assert.equal(teksTarget(T, 'respons_pengaduan'), 'Target ≤ 1 jam');
  assert.match(teksTarget(T, 'opex_per_kamar'), /^Target ≤ Rp/);
  assert.equal(teksTarget({ ...T, collection_rate: 92.5 }, 'collection_rate'), 'Target 92,5 %');
});

test('bar pencapaian: tinggi-lebih-baik dan batas-atas', () => {
  assert.equal(persenCapai(45, 90), 50);
  assert.equal(persenCapai(120, 90), 100);
  assert.equal(persenCapai(null, 90), null);
  assert.equal(persenBatas(10, 20), 100);
  assert.equal(persenBatas(40, 20), 50);
});

test('izin: owner semua, kepala divisi hanya divisinya, pengawas tidak boleh mengubah', () => {
  assert.ok(bolehUbahTarget('owner', 'sales'));
  assert.ok(bolehUbahTarget('sales', 'sales'));
  assert.ok(!bolehUbahTarget('sales', 'marketing'));
  assert.ok(!bolehUbahTarget('pengawas', 'sales'));
  assert.deepEqual(divisiTerlihat('marketing'), ['marketing']);
  assert.equal(divisiTerlihat('pengawas').length, 4);
});
