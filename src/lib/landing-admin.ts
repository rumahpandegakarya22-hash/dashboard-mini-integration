import { SignJWT } from 'jose';

// Admin landing page berdiri sendiri (proyek dan database terpisah, password sendiri). Dashboard tidak menyimpan
// atau meneruskan password itu: ia hanya menandatangani tiket singkat (60 detik) yang ditukar landing menjadi
// sesi admin. Rahasia penandatangan (LANDING_SSO_SECRET) sama di kedua proyek.

export const ISSUER_SSO = 'kost-dashboard';
export const AUDIENCE_SSO = 'landing-admin';
export const TTL_SSO_DETIK = 60;
const URL_LANDING_BAWAAN = 'https://tigadaralandingpage.vercel.app';
const PANJANG_RAHASIA_MIN = 32;

// Hanya owner, admin, dan marketing. Satu akun bisa punya peran di kedua sisi dengan nama berbeda
// (Dashboard: owner/admin/marketing; Ops: owner/staff_admin/staff_marketing); cukup salah satu yang berhak.
const ROLE_OPS = new Set(['owner', 'staff_admin', 'staff_marketing']);
const ROLE_DASHBOARD = new Set(['owner', 'admin', 'marketing']);

export function bolehBukaLandingAdmin(peran: { ops?: string | null; dashboard?: string | null }): boolean {
  return (!!peran.ops && ROLE_OPS.has(peran.ops)) || (!!peran.dashboard && ROLE_DASHBOARD.has(peran.dashboard));
}

export async function buatTokenSso(rahasia: string, sekarang: Date = new Date(), oleh?: string): Promise<string> {
  if (!rahasia || rahasia.length < PANJANG_RAHASIA_MIN) {
    throw new Error(`Rahasia LANDING_SSO_SECRET belum diatur atau kurang dari ${PANJANG_RAHASIA_MIN} karakter.`);
  }
  const iat = Math.floor(sekarang.getTime() / 1000);
  const jwt = new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER_SSO)
    .setAudience(AUDIENCE_SSO)
    .setJti(crypto.randomUUID())
    .setIssuedAt(iat)
    .setExpirationTime(iat + TTL_SSO_DETIK);
  if (oleh) jwt.setSubject(oleh);
  return jwt.sign(new TextEncoder().encode(rahasia));
}

export function urlLandingAdmin(basis: string | undefined, token: string): string {
  const b = basis?.trim() || URL_LANDING_BAWAAN;
  if (!/^https?:\/\//i.test(b)) throw new Error('LANDING_ADMIN_URL harus berupa URL http(s).');
  return `${b.replace(/\/+$/, '')}/admin/sso?token=${encodeURIComponent(token)}`;
}
