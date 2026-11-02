import test from 'node:test';
import assert from 'node:assert/strict';
import { LAPORAN, cariLaporan, boleh, bacaBody } from './registry';
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
