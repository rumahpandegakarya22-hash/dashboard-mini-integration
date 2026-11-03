import { SignJWT } from 'jose';

// Admin landing page berdiri sendiri (proyek dan database terpisah, password sendiri). Dashboard tidak menyimpan
// atau meneruskan password itu: ia hanya menandatangani tiket singkat (60 detik) yang ditukar landing menjadi
// sesi admin. Rahasia penandatangan (LANDING_SSO_SECRET) sama di kedua proyek.

export const ISSUER_SSO = 'kost-dashboard';
export const AUDIENCE_SSO = 'landing-admin';
export const TTL_SSO_DETIK = 60;
const URL_LANDING_BAWAAN = 'https://tigadaralandingpage.vercel.app';
const PANJANG_RAHASIA_MIN = 32;

// Sama dengan gerbang halaman editor lama: owner dan pengawas (semua akses), admin, dan marketing.
const ROLE_LANDING_ADMIN = new Set(['owner', 'pengawas', 'staff_admin', 'staff_marketing']);

export function bolehBukaLandingAdmin(role: string | null | undefined): boolean {
  return Boolean(role) && ROLE_LANDING_ADMIN.has(role as string);
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
