import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { susunKinerjaAdmin, ambilPelanggaran, ambilKecelakaan } from '../builders/admin';
import { htmlKinerjaAdmin } from './kinerja-admin';
import { parsePeriode } from '../periode';

const periode = parsePeriode('2026-06', new Date('2026-11-02'));
const dibuat = new Date('2026-07-05T07:15:00Z');

const kpi = [
  { nama: 'Respons Pengaduan', nilai: '0,5 jam', target: '≤ 1 jam', status: 'tercapai' as const },
  { nama: 'Dokumen Penghuni Lengkap', nilai: '80 %', target: '≥ 100 %', status: 'belum' as const },
  { nama: 'Kepuasan Penghuni (CSAT)', nilai: '—', target: 'Skala 1–5', status: 'info' as const },
];

const fb = (o = {}) => ({ tanggal: '2026-06-03', kamar: '5', kategori: 'Kebersihan', deskripsi: 'Lantai licin', status: 'Selesai', ...o });

test('kinerja admin: header, bagian, label, lampiran', () => {
  const d = susunKinerjaAdmin(periode, dibuat, [
    fb(), fb({ kategori: 'Fasilitas', status: 'Diproses' }), fb({ status: 'Menunggu' }), fb({ status: 'Dibatalkan' }), fb({ status: 'Review' }),
  ], [], [], kpi);
  const h = htmlKinerjaAdmin(d);
  assert.match(h, /LAPORAN KINERJA ADMIN/);
  assert.match(h, /Kost Tiga Dara Putri UGM/);
  assert.ok(h.includes('Periode: Juni 2026   |   Dibuat: 05 Jul 2026 14:15'));
  for (const s of [
    'A. Indikator Kinerja Admin — Juni 2026', 'B. Penanganan Feedback Penghuni — Juni 2026', 'Total Feedback Masuk', 'Selesai Ditangani', 'Masih Proses', 'Kategori',
    'C. Pelanggaran Peraturan', 'Total Pelanggaran', 'Jenis', 'D. Logbook Kecelakaan Kerja', 'Total Kecelakaan Kerja', 'Lokasi',
    'LAMPIRAN — Detail Logbook (Juni 2026)', 'Lampiran 1. Logbook Feedback', 'Lampiran 2. Logbook Pelanggaran Peraturan', 'Lampiran 3. Logbook Kecelakaan Kerja',
  ]) assert.ok(h.includes(s), s);
  assert.match(h, /<td>Total Feedback Masuk<\/td><td>5<\/td>/);
  assert.match(h, /<td>Selesai Ditangani<\/td><td>1<\/td>/);
  assert.match(h, /<td>Masih Proses<\/td><td>3<\/td>/);
  assert.ok(!h.includes('Total Biaya Penanganan'));
  assert.match(h, /<td>Kategori<\/td><td>Kebersihan \(4\)<\/td>/);
  assert.match(h, /<td>Respons Pengaduan<\/td><td>0,5 jam<\/td><td>≤ 1 jam<\/td><td><span class="pil pil-baik">Tercapai<\/span><\/td>/);
  assert.match(h, /<td>Dokumen Penghuni Lengkap<\/td><td>80 %<\/td><td>≥ 100 %<\/td><td><span class="pil pil-buruk">Belum tercapai<\/span><\/td>/);
  assert.match(h, /<td>Kepuasan Penghuni \(CSAT\)<\/td><td>—<\/td><td>Skala 1–5<\/td>/);
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
  assert.ok(!h.replace(/<style>[\s\S]*?<\/style>/, '').includes('NaN'), 'tanpa NaN di isi laporan (font base64 di <style> dikecualikan)');
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
  assert.ok(!h.includes('<script>') && !h.includes('<b>K</b>'));
  assert.match(h, /&lt;script&gt;1&lt;\/script&gt; &amp; &quot;x&quot;/);
});

async function dbUji() {
  const db = createClient({ url: ':memory:' });
  await db.execute('CREATE TABLE occupancy_history (id_penghuni TEXT PRIMARY KEY, nama TEXT, no_kamar TEXT)');
  await db.execute('CREATE TABLE pelanggaran_peraturan (id INTEGER PRIMARY KEY AUTOINCREMENT, tanggal TEXT, id_penghuni TEXT, jenis TEXT, deskripsi TEXT, tindakan TEXT)');
  await db.execute('CREATE TABLE kecelakaan_kerja (id INTEGER PRIMARY KEY AUTOINCREMENT, tanggal TEXT, lokasi TEXT, petugas TEXT, kronologi TEXT, tindakan TEXT)');
  await db.execute("INSERT INTO occupancy_history VALUES ('KTD-1', 'Rina', '5')");
  return db;
}

test('ambilPelanggaran: hanya periode laporan, pihak = nama + kamar, tindakan kosong jadi -', async () => {
  const db = await dbUji();
  const ins = (t: string, id: string, tindakan: string | null) =>
    db.execute({ sql: 'INSERT INTO pelanggaran_peraturan (tanggal, id_penghuni, jenis, deskripsi, tindakan) VALUES (?, ?, ?, ?, ?)', args: [t, id, 'Kebisingan', 'Musik malam', tindakan] });
  await ins('2026-06-30', 'KTD-1', 'Teguran'); // dalam periode (hari terakhir)
  await ins('2026-06-10', 'KTD-1', null);
  await ins('2026-07-01', 'KTD-1', 'Teguran'); // di luar
  await ins('2026-05-31', 'KTD-1', 'Teguran'); // di luar
  await ins('2026-06-15', 'KTD-X', 'Teguran'); // penghuni tidak ada di riwayat
  const r = await ambilPelanggaran(periode, db);
  assert.equal(r.length, 3);
  assert.deepEqual(r.map(x => x.tanggal), ['2026-06-10', '2026-06-15', '2026-06-30']);
  assert.deepEqual(r[0], { tanggal: '2026-06-10', jenis: 'Kebisingan', deskripsi: 'Musik malam', pihak: 'Rina (Kamar 5)', tindakan: '-' });
  assert.equal(r[1].pihak, '-');
});

test('ambilKecelakaan: hanya periode laporan dan dipetakan ke baris laporan', async () => {
  const db = await dbUji();
  const ins = (t: string) =>
    db.execute({ sql: 'INSERT INTO kecelakaan_kerja (tanggal, lokasi, petugas, kronologi, tindakan) VALUES (?, ?, ?, ?, NULL)', args: [t, 'Dapur', 'Dewi', 'Tersiram air panas'] });
  await ins('2026-06-10'); await ins('2026-07-02'); await ins('2026-05-20');
  const r = await ambilKecelakaan(periode, db);
  assert.deepEqual(r, [{ tanggal: '2026-06-10', lokasi: 'Dapur', petugas: 'Dewi', kronologi: 'Tersiram air panas', tindakan: '-' }]);
});

test('laporan admin: baris pelanggaran dan kecelakaan dari database tampil di lampiran', async () => {
  const db = await dbUji();
  await db.execute("INSERT INTO pelanggaran_peraturan (tanggal, id_penghuni, jenis, deskripsi, tindakan) VALUES ('2026-06-08', 'KTD-1', 'Kebisingan', 'Musik malam', 'Teguran')");
  await db.execute("INSERT INTO kecelakaan_kerja (tanggal, lokasi, petugas, kronologi, tindakan) VALUES ('2026-06-10', 'Dapur', 'Dewi', 'Tersiram air panas', 'Diobati')");
  const d = susunKinerjaAdmin(periode, dibuat, [], await ambilPelanggaran(periode, db), await ambilKecelakaan(periode, db));
  const h = htmlKinerjaAdmin(d);
  assert.match(h, /<td>08 Jun 2026<\/td><td>Kebisingan<\/td><td>Musik malam<\/td><td>Rina \(Kamar 5\)<\/td><td>Teguran<\/td>/);
  assert.match(h, /<td>10 Jun 2026<\/td><td>Dapur<\/td><td>Dewi<\/td><td>Tersiram air panas<\/td><td>Diobati<\/td>/);
  assert.match(h, /<td>Total Pelanggaran<\/td><td>1<\/td>/);
  assert.match(h, /<td>Total Kecelakaan Kerja<\/td><td>1<\/td>/);
});
