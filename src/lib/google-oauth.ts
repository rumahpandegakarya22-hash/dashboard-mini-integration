import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

function redirectUri(): string {
  const base = process.env.APP_BASE_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/auth/google/callback`;
}

/** URL utk redirect user ke consent screen Google. `state` = token CSRF (dicek lagi saat callback). */
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  id_token: string;
  access_token: string;
  error?: string;
  error_description?: string;
}

/** Tukar authorization code dari callback dengan id_token. */
export async function exchangeGoogleCode(code: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code'
    })
  });
  const data: GoogleTokenResponse = await res.json();
  if (!res.ok || !data.id_token) {
    throw new Error(data.error_description || data.error || 'Gagal menukar kode otorisasi Google.');
  }
  return data.id_token;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

/** Verifikasi id_token Google (signature, issuer, audience) via JWKS resmi Google. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: process.env.GOOGLE_OAUTH_CLIENT_ID
  });
  const email = String(payload.email || '');
  if (!email) throw new Error('Token Google tidak berisi email.');
  return {
    sub: String(payload.sub),
    email,
    name: String(payload.name || email),
    emailVerified: payload.email_verified !== false
  };
}
