import test from 'node:test';
import assert from 'node:assert/strict';
import { LAPORAN, cariLaporan, boleh } from './registry';
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
