import test from 'node:test';
import assert from 'node:assert/strict';
import type { DataKinerjaKeuangan } from '../builders/keuangan';
import { susunKategori } from '../builders/keuangan';
import { htmlKinerjaKeuangan } from './kinerja-keuangan';
import { parsePeriode } from '../periode';

const periode = parsePeriode('2026-06', new Date('2026-11-02'));

function dasar(): DataKinerjaKeuangan {
  return {
    periode,
    dibuat: new Date('2026-07-05T07:15:00Z'),
    kasMasuk: 3000000, kasKeluar: 500000, arusBersih: 2500000, jumlahTransaksi: 2,
    pendapatan: 3000000, beban: 3175000, laba: -175000,
    perKategori: [{ kategori: 'Operasional', total: 3175000 }],
    transaksi: [
      { tanggal: '2026-06-02', debit: 'Kas', kredit: 'Pendapatan Sewa', nominal: 3000000, keterangan: 'Sewa Rina' },
      { tanggal: '2026-06-09', debit: 'Beban Listrik', kredit: 'Kas', nominal: 500000, keterangan: 'Token' },
    ],
  };
}

test('keuangan: header, subjudul, periode dan waktu WIB', () => {
  const h = htmlKinerjaKeuangan(dasar());
  assert.match(h, /LAPORAN KINERJA KEUANGAN/);
  assert.match(h, /Kost Tiga Dara Putri UGM/);
  assert.ok(h.includes('Periode: Juni 2026   |   Dibuat: 05 Jul 2026 14:15'));
  assert.ok(h.includes('Catatan: ini rekap kinerja kas &amp; laba bulanan. Laporan akuntansi formal (Laba Rugi, Neraca, Arus Kas) tetap dihasilkan melalui modul Laporan Keuangan.'));
});

test('keuangan: bagian A-D dan label', () => {
  const h = htmlKinerjaKeuangan(dasar());
  for (const s of [
    'A. Kinerja Arus Kas — Juni 2026', 'Kas Masuk', 'Kas Keluar', 'Arus Kas Bersih', 'Jumlah Transaksi',
    'B. Kinerja Laba/Rugi (berbasis pengakuan)', 'Pendapatan', 'Beban', 'Laba / (Rugi) Bulan Ini',
    'C. Pengeluaran per Kategori', 'Total Pengeluaran', 'D. Rincian Transaksi',
  ]) assert.ok(h.includes(s), s);
  for (const k of ['Tgl', 'Debit', 'Kredit', 'Nominal', 'Keterangan']) assert.ok(h.includes(`<th>${k}</th>`), k);
  assert.match(h, /<td>Kas Masuk<\/td><td>Rp3\.000\.000<\/td>/);
  assert.match(h, /<td>Operasional<\/td><td>Rp3\.175\.000<\/td>/);
  assert.match(h, /<td>02 Jun 2026<\/td><td>Kas<\/td><td>Pendapatan Sewa<\/td><td>Rp3\.000\.000<\/td><td>Sewa Rina<\/td>/);
});

test('keuangan: laba negatif tampil -Rp', () => {
  const h = htmlKinerjaKeuangan(dasar());
  assert.match(h, /<td>Laba \/ \(Rugi\) Bulan Ini<\/td><td>-Rp175\.000<\/td>/);
});

test('keuangan: tanda tangan', () => {
  const h = htmlKinerjaKeuangan(dasar());
  assert.match(h, /Dibuat oleh,/);
  assert.match(h, /\(________________\)/);
  assert.match(h, /Staf Divisi/);
  assert.match(h, /Mengetahui,/);
  assert.match(h, /Pengelola Kost/);
});

test('keuangan: bulan kosong tetap utuh dengan Rp0', () => {
  const d: DataKinerjaKeuangan = {
    ...dasar(), kasMasuk: 0, kasKeluar: 0, arusBersih: 0, jumlahTransaksi: 0,
    pendapatan: 0, beban: 0, laba: 0, perKategori: [], transaksi: [],
  };
  const h = htmlKinerjaKeuangan(d);
  assert.match(h, /Tidak ada transaksi pada periode ini\./);
  assert.ok(h.includes('<th>Keterangan</th>'));
  assert.match(h, /<td>Kas Masuk<\/td><td>Rp0<\/td>/);
  assert.ok(!h.includes('NaN'));
  assert.ok(!h.includes('undefined'));
});

test('keuangan: teks database di-escape', () => {
  const d = dasar();
  d.transaksi[0].keterangan = '<script>alert("x")</script> & co';
  d.perKategori[0].kategori = '<b>X</b>';
  const h = htmlKinerjaKeuangan(d);
  assert.ok(!h.includes('<script>'));
  assert.ok(!h.includes('<b>X</b>'));
  assert.match(h, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; co/);
});

test('susunKategori: gabung, buang nol, urut turun, kosong jadi Lainnya', () => {
  const r = susunKategori([
    { kategori: 'Operasional', total: 1000 },
    { kategori: null, total: 500 },
    { kategori: ' ', total: 250 },
    { kategori: 'Operasional', total: 2000 },
    { kategori: 'Nol', total: 0 },
  ]);
  assert.deepEqual(r, [{ kategori: 'Operasional', total: 3000 }, { kategori: 'Lainnya', total: 750 }]);
});

test('susunKategori: jumlah kategori sama dengan beban bila data konsisten', () => {
  const r = susunKategori([{ kategori: 'Operasional', total: 3731250 }]);
  assert.equal(r.reduce((s, x) => s + x.total, 0), 3731250);
});
