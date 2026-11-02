import test from 'node:test';
import assert from 'node:assert/strict';
import { kodeBulanJakarta, kodeBulanLalu, parsePeriode, periodeSebelumnya } from './periode';

test('Februari kabisat berakhir 29', () => {
  assert.equal(parsePeriode('2028-02', new Date('2028-03-05')).sampai, '2028-02-29');
});
test('label Indonesia', () => {
  assert.equal(parsePeriode('2026-10', new Date('2026-11-02')).label, 'Oktober 2026');
});
test('menolak format salah dan masa depan', () => {
  for (const k of ['2026-13', 'abcd', '2026-1', '2099-01']) assert.throws(() => parsePeriode(k, new Date('2026-11-02')), /Periode tidak valid\./);
});
test('periodeSebelumnya dari 1 November 2026 = 2026-10', () => {
  assert.equal(periodeSebelumnya(new Date('2026-11-01T01:00:00Z')).kode, '2026-10');
});
test('periodeSebelumnya dari 1 Januari = Desember tahun lalu', () => {
  assert.equal(periodeSebelumnya(new Date('2027-01-01T01:00:00Z')).kode, '2026-12');
});
test('periode berjalan diterima, dari/sampai benar', () => {
  const p = parsePeriode('2026-10', new Date('2026-11-02'));
  assert.equal(p.dari, '2026-10-01');
  assert.equal(p.sampai, '2026-10-31');
});
test('kodeBulanLalu mengikuti WIB', () => {
  assert.equal(kodeBulanLalu(new Date('2026-11-02T00:00:00Z')), '2026-10');
  assert.equal(kodeBulanLalu(new Date('2026-12-31T20:00:00Z')), '2026-12');
});
test('kodeBulanJakarta', () => { assert.equal(kodeBulanJakarta(new Date('2026-12-31T20:00:00Z')), '2027-01'); });

test('adalahBulanBerjalan mengikuti WIB', async () => {
  const { adalahBulanBerjalan } = await import('./periode');
  assert.equal(adalahBulanBerjalan('2026-11', new Date('2026-11-02T00:00:00Z')), true);
  assert.equal(adalahBulanBerjalan('2026-10', new Date('2026-11-02T00:00:00Z')), false);
  // 31 Okt 20:00 UTC = 1 Nov 03:00 WIB
  assert.equal(adalahBulanBerjalan('2026-11', new Date('2026-10-31T20:00:00Z')), true);
  assert.equal(adalahBulanBerjalan('2026-10', new Date('2026-10-31T20:00:00Z')), false);
  assert.equal(adalahBulanBerjalan('2026-10', new Date('2026-10-31T16:59:00Z')), true);
});
