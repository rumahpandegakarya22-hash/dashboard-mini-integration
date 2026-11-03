import test from 'node:test';
import assert from 'node:assert/strict';
import { jwtVerify, decodeJwt } from 'jose';
import { bolehBukaLandingAdmin, buatTokenSso, urlLandingAdmin, TTL_SSO_DETIK, ISSUER_SSO, AUDIENCE_SSO } from './landing-admin';

const RAHASIA = 'rahasia-uji-yang-cukup-panjang-untuk-hs256-0123456789';
const kunci = new TextEncoder().encode(RAHASIA);

test('bolehBukaLandingAdmin: hanya owner, pengawas, staff_admin, staff_marketing', () => {
  for (const r of ['owner', 'pengawas', 'staff_admin', 'staff_marketing']) assert.equal(bolehBukaLandingAdmin(r), true, r);
  for (const r of ['staff_sales', 'staff_finance', 'staff_cleaning', 'staff_maintenance', 'staff_inspeksi', '', 'admin', 'OWNER']) {
    assert.equal(bolehBukaLandingAdmin(r), false, r);
  }
  assert.equal(bolehBukaLandingAdmin(undefined), false);
  assert.equal(bolehBukaLandingAdmin(null), false);
});

test('buatTokenSso: HS256, issuer/audience tetap, umur 60 detik, jti unik', async () => {
  const sekarang = new Date('2026-11-03T10:00:00Z');
  const t1 = await buatTokenSso(RAHASIA, sekarang);
  const t2 = await buatTokenSso(RAHASIA, sekarang);
  const { payload, protectedHeader } = await jwtVerify(t1, kunci, {
    issuer: ISSUER_SSO,
    audience: AUDIENCE_SSO,
    currentDate: sekarang,
    algorithms: ['HS256'],
  });
  assert.equal(protectedHeader.alg, 'HS256');
  assert.equal(payload.iat, Math.floor(sekarang.getTime() / 1000));
  assert.equal((payload.exp as number) - (payload.iat as number), TTL_SSO_DETIK);
  assert.equal(TTL_SSO_DETIK, 60);
  assert.ok(typeof payload.jti === 'string' && payload.jti.length >= 16);
  assert.notEqual(decodeJwt(t1).jti, decodeJwt(t2).jti);
});

test('buatTokenSso: tidak boleh memuat password atau rahasia di dalam payload', async () => {
  const t = await buatTokenSso(RAHASIA, new Date('2026-11-03T10:00:00Z'), 'Rina');
  const payload = decodeJwt(t);
  assert.ok(!JSON.stringify(payload).includes(RAHASIA));
  assert.deepEqual(Object.keys(payload).sort(), ['aud', 'exp', 'iat', 'iss', 'jti', 'sub']);
  assert.equal(payload.sub, 'Rina');
});

test('buatTokenSso: ditolak setelah kedaluwarsa dan dengan kunci salah', async () => {
  const sekarang = new Date('2026-11-03T10:00:00Z');
  const t = await buatTokenSso(RAHASIA, sekarang);
  const lewat = new Date(sekarang.getTime() + (TTL_SSO_DETIK + 5) * 1000);
  await assert.rejects(jwtVerify(t, kunci, { issuer: ISSUER_SSO, audience: AUDIENCE_SSO, currentDate: lewat }), /exp/i);
  await assert.rejects(jwtVerify(t, new TextEncoder().encode('kunci-lain-yang-juga-panjang-0123456789abc'), { issuer: ISSUER_SSO, audience: AUDIENCE_SSO, currentDate: sekarang }));
});

test('buatTokenSso: menolak rahasia kosong atau terlalu pendek', async () => {
  await assert.rejects(buatTokenSso('', new Date()), /rahasia/i);
  await assert.rejects(buatTokenSso('pendek', new Date()), /rahasia/i);
});

test('urlLandingAdmin: menempelkan token di /admin/sso, token di-encode, basis default produksi', () => {
  assert.equal(urlLandingAdmin('https://landing.contoh.id', 'a.b.c'), 'https://landing.contoh.id/admin/sso?token=a.b.c');
  assert.equal(urlLandingAdmin('https://landing.contoh.id/', 'x y'), 'https://landing.contoh.id/admin/sso?token=x%20y');
  assert.equal(urlLandingAdmin(undefined, 't'), 'https://tigadaralandingpage.vercel.app/admin/sso?token=t');
  assert.equal(urlLandingAdmin('   ', 't'), 'https://tigadaralandingpage.vercel.app/admin/sso?token=t');
});

test('urlLandingAdmin: basis bukan http(s) ditolak agar tidak jadi open-redirect ke skema lain', () => {
  assert.throws(() => urlLandingAdmin('javascript:alert(1)', 't'), /URL/i);
  assert.throws(() => urlLandingAdmin('ftp://x.id', 't'), /URL/i);
});
