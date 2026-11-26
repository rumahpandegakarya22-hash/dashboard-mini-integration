import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitung, normalisasi, biayaListrik } from './hitung';
import { SKENARIO_DEFAULT } from './default';
import type { SkenarioInput } from './tipe';

const dekat = (a: number | null, b: number, tol = 1e-3) =>
  assert.ok(a !== null && Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const salin = (): SkenarioInput => structuredClone(SKENARIO_DEFAULT);

function semuaAngkaHingga(v: unknown, jalur = 'hasil'): void {
  if (typeof v === 'number') assert.ok(Number.isFinite(v), `${jalur} = ${v}`);
  else if (Array.isArray(v)) v.forEach((x, i) => semuaAngkaHingga(x, `${jalur}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) semuaAngkaHingga(x, `${jalur}.${k}`);
}

test('golden: skenario default sama dengan hitungan sheet yang sudah dikoreksi', () => {
  const h = hitung(SKENARIO_DEFAULT);
  assert.equal(h.pendapatan, 28_050_000);
  dekat(h.listrikFasum, 346_560);
  dekat(h.listrikFasumKwhHari, 8);
  dekat(h.perTipe[0].listrikPerKamar, 86_423.4);
  dekat(h.pbbBulanan, 190_944.117);
  dekat(h.biayaVariabel, 2_410_585);
  dekat(h.biayaTetap, 9_992_504.117);
  dekat(h.penyusutan, 4_480_000);
  dekat(h.opex, 7_923_089.117);
  dekat(h.oer, 0.28246, 1e-5);
  dekat(h.labaBersih, 15_646_910.883);
  dekat(h.wacm, 854_647.167);
  assert.equal(h.bep, 12);
  dekat(h.bepOkupansi, 0.4, 1e-9);
  dekat(h.marginOfSafety, 0.6, 1e-9);
  assert.equal(h.cac, 6_250);
  assert.equal(h.roiTahunan, null);
  assert.equal(h.paybackUsaha, null);
  assert.equal(h.totalKamar, 30);
  assert.equal(h.kamarTerisi, 30);
  semuaAngkaHingga(h);
});

test('upgrade: tambahan laba per bulan, payback dalam bulan, ROI tahunan', () => {
  const s = salin();
  const nonaktif = hitung(s);
  assert.equal(nonaktif.upgrade.deltaLaba, 70_000);
  s.upgrade.aktif = true;
  const h = hitung(s);
  assert.equal(h.upgrade.deltaLaba, 70_000);
  assert.equal(h.upgrade.payback, 243);
  dekat(h.upgrade.roiTahunan, 0.049412, 1e-6);
  dekat(h.labaBersih, 15_716_910.883);
});

test('pajak opsional atas pendapatan', () => {
  const s = salin();
  s.umum.pajakAktif = true;
  s.umum.pajakPersen = 10;
  const h = hitung(s);
  dekat(h.pajak, 2_805_000);
  dekat(h.labaBersih, 12_841_910.883);
  s.umum.pajakAktif = false;
  assert.equal(hitung(s).pajak, 0);
});

test('modal awal: ROI tahunan dan payback usaha', () => {
  const s = salin();
  s.investasi.modalAwal = 1_000_000_000;
  const h = hitung(s);
  dekat(h.roiTahunan, (15_646_910.883 * 12) / 1e9, 1e-9);
  assert.equal(h.paybackUsaha, Math.ceil(1e9 / h.labaBersih));
});

test('faktor pemakaian dan alat nonaktif', () => {
  const alat = { nama: 'x', watt: 100, jumlah: 2, jamPerHari: 10, faktorPemakaian: 100, aktif: true };
  dekat(biayaListrik([alat], 30, 1000).kwhBulan, 60);
  dekat(biayaListrik([{ ...alat, faktorPemakaian: 50 }], 30, 1000).biaya, 30_000);
  assert.equal(biayaListrik([{ ...alat, aktif: false }], 30, 1000).biaya, 0);
});

test('tepi: tanpa tipe kamar tidak ada NaN/Infinity dan rasio null', () => {
  const s = salin();
  s.tipeKamar = [];
  const h = hitung(s);
  assert.equal(h.totalKamar, 0);
  assert.equal(h.oer, null);
  assert.equal(h.wacm, null);
  assert.equal(h.bep, null);
  assert.equal(h.okupansi, null);
  semuaAngkaHingga(h);
});

test('tepi: penghuni baru 0 dan laba negatif', () => {
  const s = salin();
  s.akuisisi.penghuniBaru = 0;
  s.investasi.modalAwal = 1_000_000;
  s.tipeKamar.forEach((t) => (t.kamarTerisi = 0));
  const h = hitung(s);
  assert.equal(h.cac, null);
  assert.equal(h.cacPayback === null || Number.isFinite(h.cacPayback), true);
  assert.ok(h.labaBersih < 0);
  assert.equal(h.paybackUsaha, null);
  assert.equal(h.marginOfSafety, null);
  assert.ok(h.peringatan.some((p) => /laba negatif/.test(p)));
  semuaAngkaHingga(h);
});

test('tepi: CM negatif membuat BEP tidak tercapai', () => {
  const s = salin();
  s.tipeKamar.forEach((t) => (t.hargaSewa = 0));
  const h = hitung(s);
  assert.equal(h.bep, null);
  semuaAngkaHingga(h);
});

test('normalisasi menjepit input tidak wajar', () => {
  const s = salin();
  s.tipeKamar[0].kamarTerisi = 40;
  s.tipeKamar[0].alatListrik[0].watt = Number.NaN;
  s.tipeKamar[0].alatListrik[1].jamPerHari = 30;
  s.tipeKamar[0].alatListrik[2].faktorPemakaian = 0;
  s.umum.hariPerBulan = 0;
  s.tipeKamar[1].jumlahKamar = -3;
  const n = normalisasi(s);
  assert.equal(n.tipeKamar[0].kamarTerisi, 25);
  assert.equal(n.tipeKamar[0].alatListrik[0].watt, 0);
  assert.equal(n.tipeKamar[0].alatListrik[1].jamPerHari, 24);
  assert.equal(n.tipeKamar[0].alatListrik[2].faktorPemakaian, 1);
  assert.equal(n.umum.hariPerBulan, 1);
  assert.equal(n.tipeKamar[1].jumlahKamar, 0);
  assert.equal(n.tipeKamar[1].kamarTerisi, 0);
  assert.equal(s.tipeKamar[0].kamarTerisi, 40, 'input asli tidak diubah');
});

test('sensitivitas: 21 titik, titik 100% = laba default, naik monoton', () => {
  const h = hitung(SKENARIO_DEFAULT);
  assert.equal(h.sensitivitas.length, 21);
  assert.equal(h.sensitivitas[0].okupansi, 0);
  assert.equal(h.sensitivitas[20].okupansi, 100);
  dekat(h.sensitivitas[20].laba, h.labaBersih);
  for (let i = 1; i < 21; i++) assert.ok(h.sensitivitas[i].laba > h.sensitivitas[i - 1].laba);
});

test('peringatan listrik kamar yang belum diisi', () => {
  const h = hitung(SKENARIO_DEFAULT);
  assert.ok(h.peringatan.includes('Listrik kamar Classic belum diisi'));
  assert.ok(h.peringatan.includes('Listrik kamar Comfy belum diisi'));
  assert.ok(!h.peringatan.some((p) => p.includes('Eco')));
});

test('barang tambahan penghuni: biaya bulanan dan tarif dibulatkan ke atas', () => {
  const h = hitung(SKENARIO_DEFAULT);
  dekat(h.barangTambahan.biaya, 33_573);
  dekat(h.barangTambahan.kwhBulan, 23.25);
  assert.equal(h.barangTambahan.tarifDibulatkan, 35_000);
});
