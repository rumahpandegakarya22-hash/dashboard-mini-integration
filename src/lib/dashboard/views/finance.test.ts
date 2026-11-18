import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFinance } from './finance';
import { petaTanggalBayar } from './tanggal-bayar';
import { parseDate, endOfDay, startOfDay } from '../format';

const HEAD = ['Tanggal', 'Akun Debit', 'Akun Kredit', 'Keterangan', 'Dampak Laba', 'Arus Kas'];
const tgl = (s: string) => parseDate(s)!;
const range = (a: string, b: string) => ({ from: startOfDay(tgl(a)), to: endOfDay(tgl(b)) });

test('penyusutan bukan OPEX, tetap mengurangi laba bersih', () => {
  const F = computeFinance(
    [
      HEAD,
      ['2025-03-05', 'Kas', 'Pendapatan Sewa', 'Pemasukan lain', '1000000', '1000000'],
      ['2025-03-10', 'Listrik', 'Kas', 'Bayar listrik', '-200000', '-200000'],
      ['2025-03-31', 'Beban Penyusutan Bangunan', 'Akum. Penyusutan Bangunan', 'Penyusutan Mar', '-300000', '-']
    ],
    range('2025-03-01', '2025-03-31')
  )!;
  assert.equal(F.beban, 200_000);
  assert.equal(F.penyusutan, 300_000);
  assert.equal(F.labaBersih, 500_000);
  assert.deepEqual(Object.keys(F.opexBy), ['Listrik']);
  assert.equal(F.expSeries.reduce((a, b) => a + b, 0), 200_000);
  assert.equal(F.labaSeries.reduce((a, b) => a + b, 0), 500_000);
});

/** Jurnal persis seperti barisJurnalSewa: terima di tanggal bayar + irisan pengakuan per bulan. */
const terima = (n: number, nama: string, kamar: string) => `Terima sewa ${n} bln dimuka ${nama} KTD ${kamar}`;
const pengakuan = (t: string, akhir: string, ke: number, nama: string, kamar: string, dl: number) => [
  t, 'Pendapatan Diterima di Muka', 'Pendapatan Sewa', `Pengakuan sewa bln-${ke} Sewa ${nama} (${kamar}) [s/d ${akhir}]`, String(dl), '-'
];

test('petaTanggalBayar: irisan dikembalikan ke tanggal bayar, termasuk bayar telat dan perpanjangan', () => {
  const baris = [
    { d: tgl('2025-01-10'), ket: terima(1, 'Rina', '5') }, // 0: bayar 10 Jan untuk 15 Jan
    { d: tgl('2025-01-15'), ket: 'Pengakuan sewa bln-1 Sewa Rina (5) [s/d 2025-01-31]' }, // 1
    { d: tgl('2025-02-01'), ket: 'Pengakuan sewa bln-1 Sewa Rina (5) [s/d 2025-02-14]' }, // 2
    { d: tgl('2025-02-20'), ket: terima(1, 'Rina', '5') }, // 3: perpanjangan dibayar telat (periode mulai 15 Feb)
    { d: tgl('2025-02-15'), ket: 'Pengakuan sewa bln-1 Sewa Rina (5) [s/d 2025-02-28]' }, // 4
    { d: tgl('2025-03-01'), ket: 'Pengakuan sewa bln-1 Sewa Rina (5) [s/d 2025-03-14]' }, // 5
    { d: tgl('2025-03-01'), ket: 'Pengakuan sewa bln-1 Sewa Budi (7) [s/d 2025-03-31]' } // 6: tanpa pembayaran → tidak tertaut
  ];
  const p = petaTanggalBayar(baris);
  assert.deepEqual([1, 2].map((i) => p.get(i)?.getTime()), [tgl('2025-01-10').getTime(), tgl('2025-01-10').getTime()]);
  assert.deepEqual([4, 5].map((i) => p.get(i)?.getTime()), [tgl('2025-02-20').getTime(), tgl('2025-02-20').getTime()]);
  assert.equal(p.has(6), false);
});

test('chart: pendapatan di tanggal bayar, nilai pengakuan Laba Rugi, semua hari terisi', () => {
  // Dua penghuni, bayar tgl 5 dan 20 Maret; masing-masing sewa 1 bulan Rp3.100.000 (Rp100.000/hari).
  const F = computeFinance(
    [
      HEAD,
      ['2025-03-05', 'Kas', 'Pendapatan Diterima di Muka', terima(1, 'Ani', '1'), '-', '3100000'],
      pengakuan('2025-03-05', '2025-03-31', 1, 'Ani', '1', 2_700_000),
      pengakuan('2025-04-01', '2025-04-04', 1, 'Ani', '1', 400_000),
      ['2025-03-20', 'Kas', 'Pendapatan Diterima di Muka', terima(1, 'Budi', '2'), '-', '3100000'],
      pengakuan('2025-03-20', '2025-03-31', 1, 'Budi', '2', 1_200_000),
      pengakuan('2025-04-01', '2025-04-19', 1, 'Budi', '2', 1_900_000)
    ],
    range('2025-03-01', '2025-03-31')
  )!;
  assert.equal(F.daily, true);
  assert.equal(F.nBuckets, 31); // 1–31 Maret, hari tanpa transaksi tetap ada
  assert.equal(F.incSeries[4], 2_700_000); // 5 Mar
  assert.equal(F.incSeries[19], 1_200_000); // 20 Mar
  assert.equal(F.incSeries[0], 0);
  assert.equal(F.incSeries[30], 0); // tidak menumpuk di akhir/awal bulan
  assert.equal(F.pendapatanKotor, 3_900_000); // kartu tetap berbasis tanggal jurnal
});
