import test from 'node:test';
import assert from 'node:assert/strict';
import { G, PAL } from '@/config/dashboard-palette';
import { PALET, campurPutih, variabelCss, warnaGradien } from './palet';
import { kerangkaDokumen } from './shell';
import { htmlKinerjaAdmin } from './templates/kinerja-admin';
import { htmlKinerjaSales } from './templates/kinerja-sales';
import { htmlKinerjaMarketing } from './templates/kinerja-marketing';
import { htmlKinerjaOperasional } from './templates/kinerja-operasional';
import { susunKinerjaAdmin } from './builders/admin';
import { susunSales } from './builders/sales';
import { susunMarketing } from './builders/marketing';
import { susunKinerjaOperasional } from './builders/operasional';
import { parsePeriode } from './periode';

const periode = parsePeriode('2026-06', new Date('2026-11-02'));
const dibuat = new Date('2026-07-05T07:15:00Z');

test('warnaGradien mengambil warna hex dari gradien Dashboard', () => {
  assert.deepEqual(warnaGradien(G.adminGreen), ['#cfe9a8', '#3fae84']);
});

test('palet donut tiap divisi diawali palet donut Dashboard yang sama', () => {
  assert.deepEqual(PALET.admin.donut.slice(0, 3), PAL.admin);
  assert.deepEqual(PALET.sales.donut.slice(0, 3), PAL.sales);
  assert.deepEqual(PALET.marketing.donut.slice(0, 4), PAL.marketing);
  assert.deepEqual(PALET.operasional.donut.slice(0, 3), PAL.operasional);
  for (const t of ['admin', 'sales', 'marketing', 'operasional'] as const) assert.equal(PALET[t].donut.length >= 6, true, t);
});

test('divisi memakai warna aksen Dashboard-nya, bukan merah Owner', () => {
  assert.equal(PALET.sales.banner, '#d0506a');
  assert.equal(PALET.marketing.banner, '#c0397a');
  assert.equal(PALET.operasional.banner, '#c0473a');
  assert.ok(PALET.admin.judul === '#2f4a3a' && PALET.admin.seri[0] === '#3fae84');
  assert.equal(PALET.owner.banner, '#c92d31');
});

test('campurPutih: 100% = warna asli, 0% = putih', () => {
  assert.equal(campurPutih('#3fae84', 1), '#3fae84');
  assert.equal(campurPutih('#3fae84', 0), '#ffffff');
});

test('CSS tema memuat variabel palet dan banner divisi; Owner tetap merah', () => {
  const sales = kerangkaDokumen('<p>x</p>', 'sales');
  assert.ok(sales.includes('--d0: #e89aa0') && sales.includes('background: #d0506a'));
  assert.ok(!sales.includes('#c92d31'));
  const owner = kerangkaDokumen('<p>x</p>', 'owner');
  assert.ok(owner.includes('background: #c92d31'));
  assert.ok(variabelCss(PALET.owner).includes('--d0: #c92d31'));
});

test('tiap laporan divisi memakai tema warna divisinya (tanpa merah Owner)', () => {
  const admin = htmlKinerjaAdmin(susunKinerjaAdmin(periode, dibuat, [], [], []));
  const sales = htmlKinerjaSales(susunSales(periode, dibuat, []));
  const marketing = htmlKinerjaMarketing(susunMarketing(periode, dibuat, [], [], []));
  const operasional = htmlKinerjaOperasional(susunKinerjaOperasional(periode, dibuat, [], [], []));
  const cek = (h: string, warna: string) => {
    const tanpaFont = h.replace(/@font-face\{[^}]*\}/g, '');
    assert.ok(tanpaFont.includes(warna), warna);
    assert.ok(!tanpaFont.includes('#c92d31'), 'tidak memakai merah Owner');
  };
  cek(admin, '#2f4a3a');
  cek(sales, '#d0506a');
  cek(marketing, '#c0397a');
  cek(operasional, '#c0473a');
});
