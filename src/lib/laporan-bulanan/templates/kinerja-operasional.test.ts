import test from 'node:test';
import assert from 'node:assert/strict';
import { susunKinerjaOperasional } from '../builders/operasional';
import { htmlKinerjaOperasional } from './kinerja-operasional';
import { parsePeriode } from '../periode';

const periode = parsePeriode('2026-06', new Date('2026-11-02'));
const dibuat = new Date('2026-07-05T07:15:00Z');

const kpi = [
  { nama: 'Kepatuhan SLA Tiket', nilai: '100 %', target: '≥ 100 %', status: 'tercapai' as const },
  { nama: 'Resolution Time', nilai: '2,5 hari', target: '≤ 1 hari', status: 'belum' as const },
];

const pm = (o = {}) => ({ tanggal: '2026-06-03', fasilitas: 'AC Kamar 5', jenis: 'Cuci AC', prioritas: 'Rendah', biaya: 150000, status: 'Selesai', ...o });
const cm = (o = {}) => ({ tanggal: '2026-06-04', lokasi: 'Kran Lantai 2', kerusakan: 'Bocor', prioritas: 'Tinggi', biaya: 200000, status: 'Selesai', ...o });

function terisi() {
  return susunKinerjaOperasional(periode, dibuat,
    [{ tindakLanjut: 'Ya, jadwalkan Perawatan' }, { tindakLanjut: 'Tidak perlu' }, { tindakLanjut: null }],
    [pm(), pm({ status: 'Proses', biaya: 50000 })],
    [cm(), cm({ prioritas: 'Darurat', biaya: 100000 }), cm({ status: 'Proses', biaya: 0 })], kpi);
}

test('kinerja operasional: header, bagian, label', () => {
  const h = htmlKinerjaOperasional(terisi());
  assert.match(h, /LAPORAN KINERJA OPERASIONAL \(INSPEKSI &amp; MAINTENANCE\)/);
  assert.match(h, /Kost Tiga Dara Putri UGM/);
  assert.ok(h.includes('Periode: Juni 2026   |   Dibuat: 05 Jul 2026 14:15'));
  for (const s of [
    'A. Indikator Kinerja Operasional — Juni 2026', 'B. Inspeksi Harian — Juni 2026', 'Total Inspeksi Dilakukan', 'Temuan Perlu Tindak Lanjut',
    'C. Perawatan (Preventif)', 'Total Kegiatan Perawatan', 'Proses/Tertunda', 'Total Biaya Perawatan',
    'D. Perbaikan (Korektif)', 'Total Laporan Kerusakan', 'Perbaikan Selesai', 'Prioritas Darurat',
    'Total Biaya Perbaikan',
    'E. Total Pengeluaran Operasional', 'Biaya Perawatan + Perbaikan',
  ]) assert.ok(h.includes(s), s);
  assert.match(h, /<th>Tgl<\/th><th>Fasilitas<\/th><th>Jenis<\/th><th>Prioritas<\/th><th>Biaya<\/th><th>Status<\/th>/);
  assert.match(h, /<th>Tgl<\/th><th>Lokasi\/Item<\/th><th>Kerusakan<\/th><th>Prioritas<\/th><th>Biaya<\/th><th>Status<\/th>/);
  assert.match(h, /<td>Total Inspeksi Dilakukan<\/td><td>3<\/td>/);
  assert.match(h, /<td>Temuan Perlu Tindak Lanjut<\/td><td>1<\/td>/);
  assert.match(h, /<td>Total Biaya Perawatan<\/td><td>Rp200\.000<\/td>/);
  assert.match(h, /<td>Prioritas Darurat<\/td><td>1<\/td>/);
  assert.ok(!h.includes('Rata-rata Durasi Perbaikan'));
  assert.match(h, /<td>Resolution Time<\/td><td>2,5 hari<\/td><td>≤ 1 hari<\/td><td><span class="pil pil-buruk">Belum tercapai<\/span><\/td>/);
  assert.match(h, /<td>Kepatuhan SLA Tiket<\/td><td>100 %<\/td><td>≥ 100 %<\/td><td><span class="pil pil-baik">Tercapai<\/span><\/td>/);
  assert.match(h, /<td>Biaya Perawatan \+ Perbaikan<\/td><td>Rp500\.000<\/td>/);
  assert.match(h, /<td>03 Jun 2026<\/td><td>AC Kamar 5<\/td><td>Cuci AC<\/td><td>Rendah<\/td><td>Rp150\.000<\/td><td>Selesai<\/td>/);
  assert.ok(!h.includes('Tidak ada'));
  assert.ok(!h.includes('Narasi') && !h.includes('Rekomendasi'));
});

test('kinerja operasional: hitung selesai/belum dan biaya', () => {
  const d = terisi();
  assert.deepEqual([d.preventif.total, d.preventif.selesai, d.preventif.belum, d.preventif.biaya], [2, 1, 1, 200000]);
  assert.deepEqual([d.korektif.total, d.korektif.selesai, d.korektif.belum, d.korektif.darurat, d.korektif.biaya], [3, 2, 1, 1, 300000]);
  assert.equal(d.totalBiaya, 500000);
});

test('kinerja operasional: tanpa perbaikan selesai', () => {
  const d = susunKinerjaOperasional(periode, dibuat, [], [], [cm({ status: 'Proses' })]);
  assert.equal(d.korektif.selesai, 0);
  assert.equal(d.korektif.belum, 1);
});

test('kinerja operasional: bulan kosong utuh', () => {
  const h = htmlKinerjaOperasional(susunKinerjaOperasional(periode, dibuat, [], [], []));
  for (const s of ['Tidak ada inspeksi pada periode ini.', 'Tidak ada perawatan pada periode ini.', 'Tidak ada perbaikan pada periode ini.'])
    assert.ok(h.includes(s), s);
  assert.match(h, /<td>Biaya Perawatan \+ Perbaikan<\/td><td>Rp0<\/td>/);
  assert.ok(!h.replace(/<style>[\s\S]*?<\/style>/, '').includes('NaN'), 'tanpa NaN (font base64 di <style> dikecualikan)');
});

test('kinerja operasional: teks database di-escape', () => {
  const d = susunKinerjaOperasional(periode, dibuat, [], [pm({ fasilitas: '<img src=x>' })], [cm({ kerusakan: '"<i>"&' })]);
  const h = htmlKinerjaOperasional(d);
  assert.ok(!h.includes('<img') && !h.includes('<i>'));
  assert.match(h, /&lt;img src=x&gt;/);
});
