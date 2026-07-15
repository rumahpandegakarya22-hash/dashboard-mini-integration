// TOTP (Google Authenticator) KUSTOM — bukan MFA Clerk (fitur Pro berbayar).
// Pola sama dgn Dashboard Figma: speakeasy, secret base32 di Clerk privateMetadata.

import speakeasy from 'speakeasy';

export interface TotpSecret {
  base32: string;
  otpauthUrl: string;
}

export function generateTotpSecret(label: string): TotpSecret {
  const secret = speakeasy.generateSecret({ name: label, length: 20 });
  return { base32: secret.base32, otpauthUrl: secret.otpauth_url || '' };
}

/** window 1 = toleransi ±30 detik (jam HP sedikit meleset tetap diterima). */
export function verifyTotpCode(secretBase32: string, code: string): boolean {
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: 'base32',
    token: String(code || '').trim(),
    window: 1
  });
}
