import test from 'node:test';
import assert from 'node:assert/strict';
import { susunKinerjaAdmin, ambilPelanggaran, ambilKecelakaan } from '../builders/admin';
import { htmlKinerjaAdmin } from './kinerja-admin';
import { parsePeriode } from '../periode';

const periode = parsePeriode('2026-06', new Date('2026-11-02'));
const dibuat = new Date('2026-07-05T07:15:00Z');

const fb = (o = {}) => ({ tanggal: '2026-06-03', kamar: '5', kategori: 'Kebersihan', deskripsi: 'Lantai licin', status: 'Selesai', ...o });

test('kinerja admin: header, bagian, label, lampiran', () => {
  const d = susunKinerjaAdmin(periode, dibuat, [
    fb(), fb({ kategori: 'Fasilitas', status: 'Diproses' }), fb({ status: 'Menunggu' }), fb({ status: 'Dibatalkan' }), fb({ status: 'Review' }),
  ], [], []);
  const h = htmlKinerjaAdmin(d);
  assert.match(h, /LAPORAN KINERJA ADMIN/);
  assert.match(h, /Kost Tiga Dara Putri UGM/);
  assert.ok(h.includes('Periode: Juni 2026   |   Dibuat: 05 Jul 2026 14:15'));
  for (const s of [
    'A. Penanganan Feedback Penghuni — Juni 2026', 'Total Feedback Masuk', 'Selesai Ditangani', 'Masih Proses', 'Total Biaya Penanganan', 'Kategori',
    'B. Pelanggaran Peraturan', 'Total Pelanggaran', 'Jenis', 'C. Logbook Kecelakaan Kerja', 'Total Kecelakaan Kerja', 'Lokasi',
    'LAMPIRAN — Detail Logbook (Juni 2026)', 'Lampiran 1. Logbook Feedback', 'Lampiran 2. Logbook Pelanggaran Peraturan', 'Lampiran 3. Logbook Kecelakaan Kerja',
  ]) assert.ok(h.includes(s), s);
  assert.match(h, /<td>Total Feedback Masuk<\/td><td>5<\/td>/);
  assert.match(h, /<td>Selesai Ditangani<\/td><td>1<\/td>/);
  assert.match(h, /<td>Masih Proses<\/td><td>3<\/td>/);
  assert.match(h, /<td>Total Biaya Penanganan<\/td><td>Rp0<\/td>/);
  assert.match(h, /<td>Kategori<\/td><td>Kebersihan \(4\)<\/td>/);
  assert.match(h, /<th>Tanggal<\/th><th>No\. Kamar<\/th><th>Kategori<\/th><th>Deskripsi<\/th><th>Status<\/th>/);
  assert.match(h, /<td>03 Jun 2026<\/td><td>5<\/td><td>Kebersihan<\/td><td>Lantai licin<\/td><td>Selesai<\/td>/);
  assert.match(h, /Dibuat oleh,[\s\S]*Staf Divisi[\s\S]*Mengetahui,[\s\S]*Pengelola Kost/);
  assert.ok(h.includes('Tidak ada pelanggaran pada periode ini.'));
  assert.ok(h.includes('Tidak ada kecelakaan kerja pada periode ini.'));
  assert.equal(h.split('Tidak ada entri pada periode ini.').length - 1, 2);
});

test('kinerja admin: bulan kosong utuh', () => {
  const h = htmlKinerjaAdmin(susunKinerjaAdmin(periode, dibuat, [], [], []));
  for (const s of ['Tidak ada feedback pada periode ini.', 'Tidak ada pelanggaran pada periode ini.', 'Tidak ada kecelakaan kerja pada periode ini.'])
    assert.ok(h.includes(s), s);
  assert.equal(h.split('Tidak ada entri pada periode ini.').length - 1, 3);
  assert.match(h, /<td>Total Feedback Masuk<\/td><td>0<\/td>/);
  assert.match(h, /<td>Kategori<\/td><td>-<\/td>/);
  assert.match(h, /<td>Total Biaya Penanganan<\/td><td>Rp0<\/td>/);
  assert.ok(!h.includes('NaN'));
});

test('kinerja admin: lampiran pelanggaran dan kecelakaan dirender bila ada baris', () => {
  const d = susunKinerjaAdmin(periode, dibuat, [], [
    { tanggal: '2026-06-08', jenis: 'Tamu menginap', deskripsi: 'Tamu lewat jam 22', pihak: 'Rina', tindakan: 'Teguran' },
    { tanggal: '2026-06-09', jenis: 'Tamu menginap', deskripsi: 'Ulang', pihak: 'Rina', tindakan: 'Peringatan' },
  ], [{ tanggal: '2026-06-10', lokasi: 'Dapur', petugas: 'Dewi', kronologi: 'Tersiram air panas', tindakan: 'Diobati' }]);
  assert.deepEqual([d.pelanggaran.total, d.pelanggaran.jenis, d.kecelakaan.total, d.kecelakaan.lokasi], [2, 'Tamu menginap (2)', 1, 'Dapur (1)']);
  const h = htmlKinerjaAdmin(d);
  assert.match(h, /<th>Tanggal<\/th><th>Jenis<\/th><th>Deskripsi<\/th><th>Penghuni\/Petugas<\/th><th>Tindakan<\/th>/);
  assert.match(h, /<td>08 Jun 2026<\/td><td>Tamu menginap<\/td><td>Tamu lewat jam 22<\/td><td>Rina<\/td><td>Teguran<\/td>/);
  assert.match(h, /<th>Tanggal<\/th><th>Lokasi<\/th><th>Petugas<\/th><th>Kronologi<\/th><th>Tindakan<\/th>/);
  assert.match(h, /<td>10 Jun 2026<\/td><td>Dapur<\/td><td>Dewi<\/td><td>Tersiram air panas<\/td><td>Diobati<\/td>/);
  assert.ok(!h.includes('Tidak ada pelanggaran') && !h.includes('Tidak ada kecelakaan'));
  assert.equal(h.split('Tidak ada entri pada periode ini.').length - 1, 1);
});

test('kinerja admin: teks database di-escape', () => {
  const d = susunKinerjaAdmin(periode, dibuat, [fb({ deskripsi: '<script>1</script> & "x"', kategori: '<b>K</b>' })], [], []);
  const h = htmlKinerjaAdmin(d);
  assert.ok(!h.includes('<script>') && !h.includes('<b>'));
  assert.match(h, /&lt;script&gt;1&lt;\/script&gt; &amp; &quot;x&quot;/);
});

test('ambilPelanggaran/ambilKecelakaan: titik sambung mengembalikan []', async () => {
  assert.deepEqual(await ambilPelanggaran(periode), []);
  assert.deepEqual(await ambilKecelakaan(periode), []);
});
