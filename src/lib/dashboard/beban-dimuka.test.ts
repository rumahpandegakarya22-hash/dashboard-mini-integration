import { test } from 'node:test';
import assert from 'node:assert/strict';
import { susunBebanDimuka, type BarisJurnalDimuka } from './beban-dimuka';
import { barisBebanDimuka } from '../jurnal';

/** Bentuk baris persis seperti yang ditulis catatPengeluaran (kode akun diganti nama). */
function jurnal(grupId: string, tanggal: string, bulan: number, nominal: number): BarisJurnalDimuka[] {
  const nama = (k: number) => (k === 1170 ? 'Beban Dibayar Dimuka' : k === 5102 ? 'Internet' : 'Kas');
  return barisBebanDimuka({ tanggal, kodeBeban: 5102, kodeSumber: 1110, nominal, jumlahBulan: bulan, keterangan: 'Paket internet', kategori: 'Operasional' }).map((b) => ({
    tanggal: b.tanggal,
    akunDebit: nama(b.debit),
    akunKredit: nama(b.kredit),
    nominal: b.nominal,
    keterangan: b.keterangan,
    grupId
  }));
}

test('6 bulan dibayar 15 Okt: per 17 Nov baru Okt yang jadi beban (diakui tiap akhir bulan)', () => {
  const [item] = susunBebanDimuka(jurnal('AF-1', '2026-10-15', 6, 600_000), '2026-11-17');
  assert.equal(item.keterangan, 'Paket internet');
  assert.equal(item.akunBeban, 'Internet');
  assert.equal(item.total, 600_000);
  assert.equal(item.bulan, 6);
  assert.equal(item.bulanBerjalan, 1);
  assert.equal(item.diakui, 100_000);
  assert.equal(item.sisa, 500_000);
  assert.equal(item.status, 'Berjalan');
  assert.equal(item.selesaiPada, '2027-03-31');
});

test('semua bulan terlewati: selesai dan sisa nol (pembulatan terserap bulan terakhir)', () => {
  const [item] = susunBebanDimuka(jurnal('AF-2', '2026-01-10', 3, 100_000), '2026-12-01');
  assert.equal(item.status, 'Selesai');
  assert.equal(item.sisa, 0);
  assert.equal(item.diakui, 100_000);
});

test('baris tanpa tanda bayar dimuka atau tanpa grup diabaikan; berjalan tampil lebih dulu', () => {
  const rows = [
    ...jurnal('AF-3', '2025-01-10', 2, 100_000),
    ...jurnal('AF-4', '2026-11-10', 12, 1_200_000),
    { tanggal: '2026-11-01', akunDebit: 'Internet', akunKredit: 'Kas', nominal: 50_000, keterangan: 'Bayar biasa', grupId: 'AF-5' },
    { tanggal: '2026-11-01', akunDebit: 'Internet', akunKredit: 'Kas', nominal: 50_000, keterangan: 'tanpa grup', grupId: '' }
  ];
  const out = susunBebanDimuka(rows, '2026-11-17');
  assert.deepEqual(out.map((x) => x.grupId), ['AF-4', 'AF-3']);
});
