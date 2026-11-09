import test from 'node:test';
import assert from 'node:assert/strict';
import { barisBebanDimuka, barisJurnalSewa, irisPerBulan } from './jurnal';
import { computeFinance } from './dashboard/views/finance';

test('irisPerBulan membagi menurut hari dan total tetap', () => {
  const s = irisPerBulan('2026-04-15', '2026-05-14', 900000);
  assert.deepEqual(s.map((x) => [x.mulai, x.akhir]), [['2026-04-15', '2026-04-30'], ['2026-05-01', '2026-05-14']]);
  assert.equal(s.reduce((t, x) => t + x.nominal, 0), 900000);
  assert.equal(s[0].nominal, 480000); // 16 dari 30 hari
});

test('sewa mulai tgl 1 tidak dipecah', () => {
  const s = irisPerBulan('2026-06-01', '2026-06-30', 850000);
  assert.equal(s.length, 1);
});

test('barisJurnalSewa: pengakuan per irisan bulan, total = tagihan', () => {
  const b = barisJurnalSewa({
    kodeKas: 1102, nama: 'Jessica', noKamar: '24', tanggalBayar: '2026-04-10', periodeAwal: '2026-04-15',
    jumlahBulan: 2, totalSewa: 1800000, totalListrik: 0, totalDenda: 0, diskon: 0, pajak: 0, grandTotal: 1800000
  });
  const pengakuan = b.filter((x) => x.keterangan.startsWith('Pengakuan sewa'));
  assert.equal(pengakuan.reduce((t, x) => t + x.nominal, 0), 1800000);
  assert.equal(pengakuan[0].tanggal, '2026-04-15');
  assert.match(pengakuan[0].keterangan, /\[s\/d 2026-04-30\]$/);
  assert.ok(pengakuan.every((x) => x.tanggal >= '2026-04-15'));
});

test('barisJurnalSewa lama: sebulan penuh per tanggal mulai', () => {
  const b = barisJurnalSewa({
    kodeKas: 1102, nama: 'J', noKamar: '1', tanggalBayar: '2026-04-10', periodeAwal: '2026-04-15',
    jumlahBulan: 2, totalSewa: 1800000, totalListrik: 0, totalDenda: 0, diskon: 0, pajak: 0, grandTotal: 1800000, lama: true
  });
  assert.equal(b.filter((x) => x.keterangan.startsWith('Pengakuan')).length, 2);
});

test('barisBebanDimuka: bayar ke 1170 lalu amortisasi per akhir bulan', () => {
  const b = barisBebanDimuka({ tanggal: '2026-04-15', kodeBeban: 5105, kodeSumber: 1102, nominal: 1000000, jumlahBulan: 3, keterangan: 'Iklan', kategori: 'Operasional' });
  assert.equal(b.length, 4);
  assert.equal(b[0].debit, 1170);
  assert.deepEqual(b.slice(1).map((x) => x.tanggal), ['2026-04-30', '2026-05-31', '2026-06-30']);
  assert.equal(b.slice(1).reduce((t, x) => t + x.nominal, 0), 1000000);
  assert.ok(b.slice(1).every((x) => x.debit === 5105 && x.kredit === 1170));
});

test('dashboard: pengakuan diakui date-to-date', () => {
  const grid = [
    ['Tanggal', 'Akun Debit', 'Akun Kredit', 'Dampak Laba', 'Arus Kas', 'Keterangan'],
    ['2026-04-15', 'Pendapatan Diterima di Muka', 'Pendapatan Sewa', '480000', '-', 'Pengakuan sewa bln-1 Sewa J (24) [s/d 2026-04-30]']
  ];
  const at = (a: string) => computeFinance(grid, { from: null, to: new Date(`${a}T23:59:59`) });
  assert.equal(at('2026-04-14'), null); // belum diakui
  assert.equal(at('2026-04-15')!.pendapatanKotor, 30000); // 1 dari 16 hari
  assert.equal(at('2026-04-30')!.pendapatanKotor, 480000);
});
