import test from 'node:test';
import assert from 'node:assert/strict';
import type { LaporanTable } from '@/lib/laporan/generator';
import {
  donutSvg, gabungSegmen, hitungDelta, labaRugiRingkas, metrikBulan, periodeLalu, pilHtml, rincianLabaRugi, rupiahRingkas,
} from './ringkasan';
import { parsePeriode } from './periode';

const lr: LaporanTable = {
  judul: 'Laba Rugi',
  baris: [
    { label: 'PENDAPATAN PENJUALAN', nilai: null, seksi: true },
    { label: 'Penerimaan Sewa Kamar', nilai: 3000000 },
    { label: 'Pendapatan Tambahan', nilai: 0 },
    { label: 'Total Pendapatan', nilai: 3000000, bold: true },
    { label: 'BEBAN OPERASIONAL', nilai: null, seksi: true },
    { label: 'Listrik', nilai: 2000000 },
    { label: 'Gaji Karyawan', nilai: 1175000 },
    { label: 'Total Beban Operasional', nilai: 3175000, bold: true },
    { label: 'LABA BERSIH', nilai: -175000, bold: true },
  ],
};

test('periodeLalu: bulan biasa dan awal tahun', () => {
  assert.equal(periodeLalu(parsePeriode('2026-10', new Date('2026-11-04'))).kode, '2026-09');
  assert.equal(periodeLalu(parsePeriode('2026-01', new Date('2026-11-04'))).kode, '2025-12');
});

test('hitungDelta: persen, pembanding nol -> null, selisih untuk poin/unit', () => {
  assert.equal(hitungDelta(110, 100, 'persen'), 10);
  assert.equal(hitungDelta(-100, -200, 'persen'), 50);
  assert.equal(hitungDelta(5, 0, 'persen'), null);
  assert.equal(hitungDelta(29, 28, 'unit'), 1);
  assert.equal(hitungDelta(93.3, 90, 'poin'), 93.3 - 90);
});

test('pilHtml: warna mengikuti baik/buruk, bukan sekadar naik/turun', () => {
  assert.match(pilHtml(12.34, 'persen', true), /pil-baik.*12,3%/);
  assert.match(pilHtml(12.34, 'persen', false), /pil-buruk/);
  assert.match(pilHtml(-5, 'persen', false), /pil-baik.*5%/);
  assert.match(pilHtml(null, 'persen', true), /pil-netral">–/);
  assert.match(pilHtml(0, 'unit', true), /Tetap/);
  assert.match(pilHtml(3.3, 'poin', true), /3,3 poin/);
});

test('rincianLabaRugi memisahkan income dan beban tanpa subtotal', () => {
  const r = rincianLabaRugi(lr);
  assert.deepEqual(r.income.map(x => x.label), ['Penerimaan Sewa Kamar', 'Pendapatan Tambahan']);
  assert.deepEqual(r.opex.map(x => x.label), ['Listrik', 'Gaji Karyawan']);
  assert.equal(r.opex.reduce((t, x) => t + x.nilai, 0), 3175000);
});

test('labaRugiRingkas: beban = pendapatan - laba; label hilang melempar', () => {
  assert.deepEqual(labaRugiRingkas(lr), { pendapatan: 3000000, beban: 3175000, laba: -175000 });
  assert.throws(() => labaRugiRingkas({ judul: 'x', baris: [] }), /Total Pendapatan/);
});

test('gabungSegmen: buang nol, urut, sisa jadi Lainnya', () => {
  const s = [1, 2, 3, 4, 5, 6, 7, 0].map((n, i) => ({ label: `A${i}`, nilai: n }));
  const g = gabungSegmen(s, 3);
  assert.deepEqual(g.map(x => x.label), ['A6', 'A5', 'Lainnya']);
  assert.equal(g[2].nilai, 5 + 4 + 3 + 2 + 1);
  assert.equal(gabungSegmen([{ label: 'X', nilai: 0 }]).length, 0);
});

test('metrikBulan: okupansi dan kamar kosong dari kamar terisi', () => {
  const m = metrikBulan({ pendapatan: 1, beban: 1, laba: 0 }, 5, 28, 30);
  assert.equal(m.kamarKosong, 2);
  assert.equal(m.okupansi, 93.3);
  assert.equal(metrikBulan({ pendapatan: 0, beban: 0, laba: 0 }, 0, 0, 0).okupansi, 0);
});

test('donutSvg: satu lingkaran per segmen, kosong tetap valid tanpa NaN', () => {
  assert.equal((donutSvg([{ label: 'a', nilai: 1 }, { label: 'b', nilai: 3 }], 'x').match(/<circle/g) ?? []).length, 2);
  const kosong = donutSvg([], 'x');
  assert.ok(kosong.includes('<circle') && !kosong.includes('NaN'));
  assert.ok(donutSvg([{ label: 'a', nilai: 1 }], '<b>').includes('&lt;b&gt;'));
});

test('rupiahRingkas', () => {
  assert.equal(rupiahRingkas(12345678), 'Rp12,3 jt');
  assert.equal(rupiahRingkas(2500000000), 'Rp2,5 M');
  assert.equal(rupiahRingkas(-175000), '-Rp175.000');
});
