import test from 'node:test';
import assert from 'node:assert/strict';
import type { DataKinerjaMarketing } from '../builders/marketing';
import { susunMarketing, kampanyeBeririsan, tanggalIso } from '../builders/marketing';
import { htmlKinerjaMarketing } from './kinerja-marketing';
import { parsePeriode } from '../periode';

const periode = parsePeriode('2026-06', new Date('2026-11-02'));
const dibuat = new Date('2026-07-05T07:15:00Z');

function dasar(): DataKinerjaMarketing {
  return {
    periode, dibuat,
    leads: { total: 3, sumberTeratas: 'Instagram (2)', statusRingkas: 'Baru (2), Follow-up (1)' },
    konten: { post: 2, reach: 3400, likes: 520, komentar: 28, shareSaves: 67, engagementPersen: 18.1, platformTeraktif: 'Instagram (2)' },
    kampanye: { jumlah: 1, budget: 300000, spend: 250000, targetLeads: 15, leadsAktual: 12, capaianPersen: 80, bookingDariPromo: 2 },
  };
}

test('marketing: header, periode, bagian dan label', () => {
  const h = htmlKinerjaMarketing(dasar());
  assert.match(h, /LAPORAN KINERJA MARKETING/);
  assert.match(h, /Kost Tiga Dara Putri UGM/);
  assert.ok(h.includes('Periode: Juni 2026   |   Dibuat: 05/07/2026 14:15'));
  for (const s of [
    'A. Akuisisi Leads — Juni 2026', 'Total Leads Masuk', 'Sumber Teratas', 'Status Leads',
    'B. Kinerja Konten Sosial Media', 'Jumlah Post', 'Total Reach', 'Total Likes', 'Total Komentar',
    'Total Share/Saves', 'Engagement Rate', 'Platform Teraktif',
    'C. Kinerja Kampanye / Promosi', 'Jumlah Kampanye', 'Total Budget', 'Total Spend Aktual',
    'Target Leads', 'Leads Aktual', 'Capaian Target', 'Booking dari Promo',
  ]) assert.ok(h.includes(s), s);
  assert.match(h, /<td>Status Leads<\/td><td>Baru \(2\), Follow-up \(1\)<\/td>/);
  assert.match(h, /<td>Total Reach<\/td><td>3\.400<\/td>/);
  assert.match(h, /<td>Engagement Rate<\/td><td>18,1%<\/td>/);
  assert.match(h, /<td>Total Budget<\/td><td>Rp300\.000<\/td>/);
  assert.match(h, /<td>Capaian Target<\/td><td>80%<\/td>/);
  assert.match(h, /Dibuat oleh,[\s\S]*Staf Divisi[\s\S]*Mengetahui,[\s\S]*Pengelola Kost/);
  assert.ok(!h.includes('Tidak ada'));
});

test('marketing: bulan kosong utuh, angka 0 bukan NaN', () => {
  const h = htmlKinerjaMarketing(susunMarketing(periode, dibuat, [], [], []));
  for (const t of ['leads', 'konten', 'kampanye']) assert.match(h, new RegExp(`Tidak ada ${t} pada periode ini\\.`));
  assert.match(h, /<td>Total Leads Masuk<\/td><td>0<\/td>/);
  assert.match(h, /<td>Sumber Teratas<\/td><td>-<\/td>/);
  assert.match(h, /<td>Status Leads<\/td><td>-<\/td>/);
  assert.match(h, /<td>Platform Teraktif<\/td><td>-<\/td>/);
  assert.match(h, /<td>Engagement Rate<\/td><td>0%<\/td>/);
  assert.match(h, /<td>Total Spend Aktual<\/td><td>Rp0<\/td>/);
  assert.match(h, /<td>Capaian Target<\/td><td>0%<\/td>/);
  assert.ok(!h.includes('NaN') && !h.includes('Infinity'));
});

test('marketing: teks database di-escape', () => {
  const d = dasar();
  d.leads.sumberTeratas = '<img src=x onerror=1> (2)';
  d.konten.platformTeraktif = '"<i>"';
  const h = htmlKinerjaMarketing(d);
  assert.ok(!h.includes('<img') && !h.includes('<i>'));
  assert.match(h, /&lt;img src=x onerror=1&gt;/);
});

const lead = (tanggal: string, sumber: string | null, status: string | null) => ({ tanggal, sumber, status });
const post = (tanggal: string, platform: string | null, likes = 0, komentar = 0, shareSaves = 0, reach = 0) =>
  ({ tanggal, platform, likes, komentar, shareSaves, reach });
const promo = (mulai: string, selesai: string | null, o: Partial<{ budget: number; spend: number; targetLeads: number; leadsAktual: number; booking: number }> = {}) =>
  ({ mulai, selesai, budget: 0, spend: 0, targetLeads: 0, leadsAktual: 0, booking: 0, ...o });

test('susunMarketing: leads dalam periode, sumber teratas, status ringkas', () => {
  const d = susunMarketing(periode, dibuat, [
    lead('2026-06-01', 'Instagram', 'Baru'), lead('2026-06-30', 'Referral', 'Follow-up'),
    lead('2026-06-15', 'Instagram', 'Baru'), lead('2026-05-31', 'Google', 'Baru'), lead('2026-07-01', 'Google', 'Baru'),
  ], [], []);
  assert.equal(d.leads.total, 3);
  assert.equal(d.leads.sumberTeratas, 'Instagram (2)');
  assert.equal(d.leads.statusRingkas, 'Baru (2), Follow-up (1)');
});

test('susunMarketing: seri diurut abjad; sumber/status kosong', () => {
  const d = susunMarketing(periode, dibuat, [
    lead('2026-06-02', 'Referral', 'Survey'), lead('2026-06-03', 'Mami Kos', 'Baru'), lead('2026-06-04', null, null),
  ], [], []);
  assert.equal(d.leads.sumberTeratas, 'Mami Kos (1)');
  assert.equal(d.leads.statusRingkas, 'Baru (1), Survey (1)');
  assert.equal(susunMarketing(periode, dibuat, [lead('2026-06-02', null, null)], [], []).leads.sumberTeratas, '-');
});

test('susunMarketing: konten, ER = (likes+komentar+share)/reach, platform teraktif', () => {
  const d = susunMarketing(periode, dibuat, [], [
    post('2026-06-03', 'Instagram', 520, 28, 67, 3400), post('2026-06-10', 'TikTok'), post('2026-06-11', 'Instagram', 1, 1, 1, 100),
    post('2026-07-01', 'TikTok', 999, 0, 0, 1),
  ], []);
  assert.equal(d.konten.post, 3);
  assert.equal(d.konten.reach, 3500);
  assert.equal(d.konten.likes, 521);
  assert.equal(d.konten.komentar, 29);
  assert.equal(d.konten.shareSaves, 68);
  assert.equal(d.konten.engagementPersen, 17.7);
  assert.equal(d.konten.platformTeraktif, 'Instagram (2)');
});

test('susunMarketing: reach 0 -> ER 0, platform seri alfabetis', () => {
  const d = susunMarketing(periode, dibuat, [], [post('2026-06-03', 'TikTok', 5), post('2026-06-04', 'Instagram', 5)], []);
  assert.equal(d.konten.engagementPersen, 0);
  assert.equal(d.konten.platformTeraktif, 'Instagram (1)');
});

test('susunMarketing: kampanye beririsan dijumlah, targetLeads 0 -> capaian 0', () => {
  const d = susunMarketing(periode, dibuat, [], [], [
    promo('2026-05-20', '2026-06-05', { budget: 100, spend: 80, targetLeads: 10, leadsAktual: 5, booking: 1 }),
    promo('2026-06-10', null, { budget: 50, spend: 20, targetLeads: 5, leadsAktual: 3, booking: 1 }),
    promo('2026-07-01', '2026-07-10', { budget: 999 }),
  ]);
  assert.deepEqual(d.kampanye, { jumlah: 2, budget: 150, spend: 100, targetLeads: 15, leadsAktual: 8, capaianPersen: 53, bookingDariPromo: 2 });
  const nol = susunMarketing(periode, dibuat, [], [], [promo('2026-06-01', '2026-06-02', { leadsAktual: 4 })]);
  assert.equal(nol.kampanye.capaianPersen, 0);
});

test('kampanyeBeririsan: kasus batas', () => {
  const { dari, sampai } = periode;
  assert.equal(kampanyeBeririsan('2026-05-20', '2026-06-05', dari, sampai), true);
  assert.equal(kampanyeBeririsan('2026-06-10', '2026-06-20', dari, sampai), true);
  assert.equal(kampanyeBeririsan('2026-06-25', '2026-07-10', dari, sampai), true);
  assert.equal(kampanyeBeririsan('2026-05-01', '2026-07-31', dari, sampai), true);
  assert.equal(kampanyeBeririsan('2026-04-01', '2026-05-31', dari, sampai), false);
  assert.equal(kampanyeBeririsan('2026-07-01', '2026-07-10', dari, sampai), false);
  assert.equal(kampanyeBeririsan('2026-06-30', null, dari, sampai), true);
  assert.equal(kampanyeBeririsan('2026-07-01', null, dari, sampai), false);
  assert.equal(kampanyeBeririsan('', '2026-06-10', dari, sampai), false);
});

test('tanggalIso: normalisasi format', () => {
  assert.equal(tanggalIso('2026-06-03'), '2026-06-03');
  assert.equal(tanggalIso('2026-06-03T10:00:00Z'), '2026-06-03');
  assert.equal(tanggalIso('3/6/2026'), '2026-06-03');
  assert.equal(tanggalIso('03/06/2026'), '2026-06-03');
  assert.equal(tanggalIso('abc'), '');
  assert.equal(tanggalIso(null), '');
});
