import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAll, type DbTables } from './compute';

const tabel = (durasiHari: number): DbTables => ({
  maintenance_cm: [{ id_tiket: 'T1', kategori: 'Elektrikal dan Elektronik', tanggal_lapor: '2026-06-01', tanggal_selesai: `2026-06-${String(1 + durasiHari).padStart(2, '0')}` }],
});

test('SLA tiket korektif: bawaan 3 hari', () => {
  assert.equal(computeAll(tabel(3)).maintenance_cm[0].sla, 'OK');
  assert.equal(computeAll(tabel(4)).maintenance_cm[0].sla, 'BREACH');
});

test('SLA tiket korektif mengikuti batas yang diatur (target KPI)', () => {
  assert.equal(computeAll(tabel(4), { slaHari: 5 }).maintenance_cm[0].sla, 'OK');
  assert.equal(computeAll(tabel(2), { slaHari: 1 }).maintenance_cm[0].sla, 'BREACH');
});

test('tiket belum selesai tidak dinilai SLA, berapa pun batasnya', () => {
  const t: DbTables = { maintenance_cm: [{ id_tiket: 'T2', kategori: 'Plumbing', tanggal_lapor: '2026-06-01' }] };
  assert.ok(!computeAll(t, { slaHari: 1 }).maintenance_cm[0].sla);
});
