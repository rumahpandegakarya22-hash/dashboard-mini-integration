import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProspek } from './prospek';
import type { BookingRow, LeadRow, SurveyRow } from './types';

const lead = (name: string, wa: string, status = 'Baru'): LeadRow => ({
  check: false, id: 'x', dbId: '1', chatPertama: '', name, wa, asal: 'IG', tanggal: '2026-10-01', status: { t: status, c: '' }
});
const survey = (nama: string, wa: string): SurveyRow => ({ check: false, nama, wa, asal: 'IG', pertimbangan: 'Harga', tanggal: '2026-10-05' });
const booking = (nama: string, status = 'Check-in'): BookingRow => ({ nama, kamar: '1', status, durasi: '', harga: '', tanggal: '', cancel: '' });

test('lead tanpa survey dan survey tanpa booking sama-sama prospek', () => {
  const r = buildProspek([lead('A', '0811')], [survey('B', '0822')], []);
  assert.deepEqual(r.map((x) => [x.name, x.tahap.t]).sort(), [['A', 'Leads'], ['B', 'Survey']]);
});

test('lead yang sudah survey tidak dobel (dicocokkan dari nomor HP)', () => {
  const r = buildProspek([lead('A', '0811')], [survey('A', '62811')], []);
  assert.equal(r.length, 1);
  assert.equal(r[0].tahap.t, 'Survey');
});

test('yang sudah booking aktif keluar dari prospek, booking batal tetap prospek', () => {
  const r = buildProspek([lead('C', '0833', 'Closing')], [survey('B', '0822'), survey('D', '0844')], [booking('B'), booking('D', 'Dibatalkan')]);
  assert.deepEqual(r.map((x) => x.name), ['D']);
});
