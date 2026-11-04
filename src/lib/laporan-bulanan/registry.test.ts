import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { LAPORAN, cariLaporan, boleh, bacaBody, pilihFolder, generateLaporan, type DepsGenerate } from './registry';
import { parsePeriode } from './periode';

const SEKARANG = new Date('2026-11-02');

test('id registri unik', () => {
  const ids = LAPORAN.map(l => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('nama berkas kerja-admin sesuai judul Drive', () => {
  assert.equal(cariLaporan('kerja-admin')?.namaFile(parsePeriode('2026-06', SEKARANG)), 'Laporan ADMIN - Juni 2026.pdf');
});

test('nama berkas 4 laporan kerja', () => {
  const p = parsePeriode('2026-06', SEKARANG);
  assert.equal(cariLaporan('kerja-keuangan')?.namaFile(p), 'Laporan KEUANGAN - Juni 2026.pdf');
  assert.equal(cariLaporan('kerja-marketing')?.namaFile(p), 'Laporan MARKETING - Juni 2026.pdf');
  assert.equal(cariLaporan('kerja-sales')?.namaFile(p), 'Laporan SALES - Juni 2026.pdf');
});

test('id tak dikenal -> undefined', () => {
  assert.equal(cariLaporan('tidak-ada'), undefined);
});

test('hanya owner-review yang ownerOnly', () => {
  for (const l of LAPORAN) if (l.ownerOnly) assert.equal(l.id, 'owner-review');
});

test('boleh(): peran ALLOWED, ownerOnly hanya owner', () => {
  const biasa = { ownerOnly: false } as never;
  const khusus = { ownerOnly: true } as never;
  assert.equal(boleh('staff_admin', biasa), true);
  assert.equal(boleh('staff_sales', biasa), true);
  assert.equal(boleh('tenant', biasa), false);
  assert.equal(boleh('staff_admin', khusus), false);
  assert.equal(boleh('owner', khusus), true);
});

test('bacaBody menolak null, non-objek, dan field bukan string', () => {
  for (const x of [null, undefined, 5, 'x', { id: 'a' }, { id: 1, periode: '2026-06' }]) assert.equal(bacaBody(x), null);
  assert.deepEqual(bacaBody({ id: 'kerja-admin', periode: '2026-06', x: 1 }), { id: 'kerja-admin', periode: '2026-06' });
});

test('owner-review terdaftar, ownerOnly, nama berkas sesuai', () => {
  const def = cariLaporan('owner-review');
  assert.ok(def);
  assert.equal(def.ownerOnly, true);
  assert.equal(def.keluarga, 'owner');
  assert.equal(def.namaFile(parsePeriode('2026-06', SEKARANG)), 'Laporan Owner Review - Juni 2026.pdf');
});

test('kinerja-keuangan dan kinerja-sales terdaftar, bukan ownerOnly, nama berkas sesuai', () => {
  const p = parsePeriode('2026-06', SEKARANG);
  const kk = cariLaporan('kinerja-keuangan');
  const ks = cariLaporan('kinerja-sales');
  assert.ok(kk && ks);
  assert.equal(kk.keluarga, 'kinerja');
  assert.equal(ks.keluarga, 'kinerja');
  assert.equal(kk.judul, 'Kinerja Keuangan');
  assert.equal(ks.judul, 'Kinerja Sales');
  assert.ok(!kk.ownerOnly && !ks.ownerOnly);
  assert.equal(kk.namaFile(p), 'Laporan Kinerja Keuangan - Juni 2026.pdf');
  assert.equal(ks.namaFile(p), 'Laporan Kinerja Sales - Juni 2026.pdf');
});

test('registri operasional dan admin: keluarga, judul, nama file', () => {
  const p = parsePeriode('2026-06', SEKARANG);
  const cek = (id: string, keluarga: string, judul: string, file: string) => {
    const d = cariLaporan(id);
    assert.ok(d, id);
    assert.equal(d.keluarga, keluarga);
    assert.equal(d.judul, judul);
    assert.ok(!d.ownerOnly);
    assert.equal(d.namaFile(p), file);
  };
  cek('kerja-operasional', 'kerja', 'Kerja Operasional', 'Laporan Kerja Divisi Operasional - Juni 2026.pdf');
  cek('kinerja-operasional', 'kinerja', 'Kinerja Operasional', 'Laporan Kinerja Operasional (Inspeksi & Maintenance) - Juni 2026.pdf');
  cek('kinerja-admin', 'kinerja', 'Kinerja Admin', 'Laporan Kinerja Admin - Juni 2026.pdf');
});

test('pilihFolder: kunci config menang; owner-review tanpa fallback; lainnya fallback env', () => {
  assert.equal(pilihFolder('kerja-admin', ' abc ', 'env'), 'abc');
  assert.equal(pilihFolder('kerja-admin', null, 'env'), 'env');
  assert.equal(pilihFolder('kerja-admin', '  ', 'env'), 'env');
  assert.equal(pilihFolder('kerja-admin', undefined, undefined), undefined);
  assert.equal(pilihFolder('owner-review', 'own', 'env'), 'own');
  assert.equal(pilihFolder('owner-review', null, 'env'), undefined);
  assert.equal(pilihFolder('owner-review', '', 'env'), undefined);
});

// Render laporan dibuat tanpa DB: def.render diganti stub agar yang diuji hanya alur catat -> arsip.
async function siapkan(opsi: { tabel?: boolean; env?: string; drive?: string | undefined } = {}) {
  const db = createClient({ url: ':memory:' });
  if (opsi.tabel !== false) {
    await db.execute('CREATE TABLE laporan_riwayat (id INTEGER PRIMARY KEY AUTOINCREMENT, periode TEXT, jenis TEXT, nama_file TEXT, drive_url TEXT, dibuat_oleh TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  }
  const arsip: string[] = [];
  const deps: Partial<DepsGenerate> = {
    db,
    htmlKePdf: async () => Buffer.from('pdf'),
    getConfig: async () => null,
    arsipkan: async (_n, _p, folder) => { arsip.push(folder); return 'drive' in opsi ? opsi.drive : 'https://drive/x'; },
    envFolder: opsi.env,
    sekarang: () => new Date('2026-11-02T03:00:00Z'),
  };
  return { db, arsip, deps };
}

function stubRender(id: string) {
  const def = cariLaporan(id)!;
  const asli = def.render;
  def.render = async () => '<html></html>';
  return () => { def.render = asli; };
}

test('generateLaporan menolak bulan berjalan (WIB) tanpa menyentuh DB/Drive', async () => {
  const { arsip, deps, db } = await siapkan({ env: 'F' });
  await assert.rejects(generateLaporan('kerja-admin', '2026-11', 'x', deps), /Bulan berjalan belum selesai/);
  assert.equal(arsip.length, 0);
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM laporan_riwayat')).rows[0].n), 0);
  const batas = { ...deps, sekarang: () => new Date('2026-10-31T20:00:00Z') };
  await assert.rejects(generateLaporan('kerja-admin', '2026-11', 'x', batas), /Bulan berjalan/);
});

test('generateLaporan: INSERT gagal -> error jelas, TIDAK ada upload Drive', async () => {
  const pulih = stubRender('kerja-admin');
  try {
    const { arsip, deps } = await siapkan({ tabel: false, env: 'F' });
    await assert.rejects(generateLaporan('kerja-admin', '2026-10', 'x', deps), /Gagal mencatat riwayat/);
    assert.equal(arsip.length, 0);
  } finally { pulih(); }
});

test('generateLaporan: INSERT dulu, lalu upload, lalu drive_url diisi', async () => {
  const pulih = stubRender('kerja-admin');
  try {
    const { db, arsip, deps } = await siapkan({ env: 'F' });
    const hasil = await generateLaporan('kerja-admin', '2026-10', 'Budi', deps);
    assert.deepEqual(arsip, ['F']);
    assert.equal(hasil.driveUrl, 'https://drive/x');
    assert.equal(hasil.catatanArsip, undefined);
    const row = (await db.execute('SELECT periode, jenis, drive_url, dibuat_oleh FROM laporan_riwayat')).rows[0];
    assert.equal(row.drive_url, 'https://drive/x');
    assert.equal(row.periode, '2026-10');
    assert.equal(row.dibuat_oleh, 'Budi');
  } finally { pulih(); }
});

test('generateLaporan: upload gagal -> riwayat tetap ada tanpa tautan, ada catatan', async () => {
  const pulih = stubRender('kerja-admin');
  try {
    const { db, deps } = await siapkan({ env: 'F', drive: undefined });
    const hasil = await generateLaporan('kerja-admin', '2026-10', 'x', deps);
    assert.match(hasil.catatanArsip ?? '', /gagal/);
    assert.equal((await db.execute('SELECT drive_url FROM laporan_riwayat')).rows[0].drive_url, null);
  } finally { pulih(); }
});

test('generateLaporan: owner-review tanpa folder tidak diarsipkan walau env keuangan ada', async () => {
  const pulih = stubRender('owner-review');
  try {
    const { db, arsip, deps } = await siapkan({ env: 'FOLDER-KEUANGAN' });
    const hasil = await generateLaporan('owner-review', '2026-10', 'x', deps);
    assert.equal(arsip.length, 0);
    assert.equal(hasil.catatanArsip, 'Owner Review tidak diarsipkan: folder Drive belum diatur.');
    assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM laporan_riwayat')).rows[0].n), 1);
  } finally { pulih(); }
});

test('laporan keuangan: id sama dengan jenis riwayat lama, nama berkas format lama, tersembunyi dari panel baru', () => {
  const p = parsePeriode('2026-10', SEKARANG);
  for (const [id, nama] of [['Cashflow', '1026-Cashflow-Kost Tiga Dara.pdf'], ['LabaRugi', '1026-LabaRugi-Kost Tiga Dara.pdf'], ['Neraca', '1026-Neraca-Kost Tiga Dara.pdf']] as const) {
    const def = cariLaporan(id);
    assert.ok(def, id);
    assert.equal(def.keluarga, 'keuangan');
    assert.equal(def.tersembunyi, true);
    assert.equal(def.email, true);
    assert.equal(def.ownerOnly, undefined);
    assert.equal(def.namaFile(p), nama);
  }
});

test('nama berkas keuangan memakai kode periode (tahun 2 digit), bukan label', () => {
  assert.equal(cariLaporan('Neraca')?.namaFile(parsePeriode('2027-01', new Date('2027-02-05'))), '0127-Neraca-Kost Tiga Dara.pdf');
});

test('email: 14 laporan ikut (1 owner + 3 keuangan + 5 kerja + 5 kinerja)', () => {
  const ikut = LAPORAN.filter(l => l.email);
  assert.equal(ikut.length, 14);
  assert.equal(ikut.filter(l => l.keluarga === 'owner').length, 1);
  assert.equal(ikut.filter(l => l.keluarga === 'keuangan').length, 3);
  assert.equal(ikut.filter(l => l.keluarga === 'kerja').length, 5);
  assert.equal(ikut.filter(l => l.keluarga === 'kinerja').length, 5);
  assert.equal(cariLaporan('owner-review')?.email, true);
});

test('laporanUntukEmail: 14 item termasuk owner-review, keluarga valid', async () => {
  const { laporanUntukEmail } = await import('./registry');
  const item = laporanUntukEmail();
  assert.equal(item.length, 14);
  assert.ok(item.some(i => i.id === 'owner-review'));
  assert.deepEqual([...new Set(item.map(i => i.keluarga))].sort(), ['kerja', 'keuangan', 'kinerja', 'owner']);
});

test('hanya laporan keuangan yang tersembunyi dari panel', () => {
  for (const l of LAPORAN) assert.equal(Boolean(l.tersembunyi), l.keluarga === 'keuangan', l.id);
});

test('renderPdf: menolak id tak dikenal dan bulan tak valid', async () => {
  const { renderPdf } = await import('./registry');
  await assert.rejects(() => renderPdf('tidak-ada', '2026-10'), /tidak valid/i);
  await assert.rejects(() => renderPdf('kerja-admin', '2026-13'), /tidak valid/i);
});

test('renderPdf: memakai render + htmlKePdf yang disuntik dan mengembalikan nama berkas', async () => {
  const { renderPdf } = await import('./registry');
  const pulih = stubRender('kerja-admin');
  try {
    const r = await renderPdf('kerja-admin', '2026-10', { htmlKePdf: async () => Buffer.from('%PDF-uji'), sekarang: () => SEKARANG });
    assert.equal(r.namaFile, 'Laporan ADMIN - Oktober 2026.pdf');
    assert.equal(r.pdf.toString(), '%PDF-uji');
  } finally { pulih(); }
});

test('laporanSudahAda: baris yang dibuat sebelum bulan berakhir diabaikan', async () => {
  const { laporanSudahAda } = await import('./registry');
  const db = createClient({ url: ':memory:' });
  await db.execute('CREATE TABLE laporan_riwayat (id INTEGER PRIMARY KEY AUTOINCREMENT, periode TEXT, jenis TEXT, nama_file TEXT, drive_url TEXT, dibuat_oleh TEXT, created_at TEXT)');
  const isi = (jenis: string, periode: string, dibuat: string) =>
    db.execute({ sql: 'INSERT INTO laporan_riwayat (periode, jenis, nama_file, created_at) VALUES (?, ?, ?, ?)', args: [periode, jenis, 'x.pdf', dibuat] });
  await isi('Cashflow', '2026-11', '2026-11-04 12:00:00'); // uji di bulan berjalan
  await isi('Neraca', '2026-10', '2026-10-31 09:00:00');   // masih di hari terakhir bulan itu: belum final
  await isi('LabaRugi', '2026-10', '2026-11-01 01:00:00'); // sesudah bulan berakhir
  assert.equal(await laporanSudahAda('Cashflow', '2026-11', db), false);
  assert.equal(await laporanSudahAda('Neraca', '2026-10', db), false);
  assert.equal(await laporanSudahAda('LabaRugi', '2026-10', db), true);
});

test('KeuanganLengkap: 3 laporan satu file, hanya Drive (tanpa email), nama file 1026-Lengkap', () => {
  const def = cariLaporan('KeuanganLengkap');
  assert.ok(def);
  assert.equal(def.email, false);
  assert.equal(def.tersembunyi, true);
  assert.equal(def.namaFile(parsePeriode('2026-10', new Date('2026-11-04'))), '1026-Lengkap-Kost Tiga Dara.pdf');
  assert.ok(!LAPORAN.filter(l => l.email).some(l => l.id === 'KeuanganLengkap'));
});

test('htmlKeuanganLengkap: urutan Arus Kas, Laba Rugi, Neraca; tiga halaman dipisah', async () => {
  const { htmlKeuanganLengkap } = await import('@/lib/laporan/template');
  const tabel = { judul: 't', baris: [{ label: 'Baris', nilai: 1000 }] };
  const html = htmlKeuanganLengkap(tabel, tabel, { judul: 'n', sisi: { kiri: tabel.baris, kanan: tabel.baris } }, '2026-10', 'Tes');
  assert.equal((html.match(/class="halaman"/g) ?? []).length, 3);
  assert.equal((html.match(/page-break-after:always/g) ?? []).length, 2);
  assert.ok(html.indexOf('Laporan Arus Kas') < html.indexOf('Laporan Laba Rugi'));
  assert.ok(html.indexOf('Laporan Laba Rugi') < html.indexOf('Neraca'));
});
