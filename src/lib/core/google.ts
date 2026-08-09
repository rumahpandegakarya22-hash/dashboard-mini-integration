import { google } from 'googleapis';

/**
 * Kredensial Google — dua skema, dipilih otomatis saat runtime:
 *
 *   1. OAuth 2.0 (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN)
 *      → untuk Drive: upload berkas ke folder yang dimiliki akun OAuth
 *   2. Service Account JWT (fallback)
 *      → untuk Drive via SA: folder yang sudah di-share ke SA
 *
 * Pengiriman email ditangani Brevo (BREVO_API_KEY) — tidak ada Gmail client di sini.
 * Token dibuat lewat: npx tsx scripts/gmail-token.ts --drive
 */

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'];

export function oauthTersedia(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

export function saTersedia(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

function getAuth() {
  if (oauthTersedia()) {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return auth;
  }
  return getSAAuth();
}

function getSAAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return new google.auth.JWT({ email, key, scopes: SCOPES });
}

let _sheets: ReturnType<typeof google.sheets> | null = null;
let _drive: ReturnType<typeof google.drive> | null = null;
let _driveSA: ReturnType<typeof google.drive> | null = null;

export function sheetsClient() {
  if (!_sheets) _sheets = google.sheets({ version: 'v4', auth: getAuth() });
  return _sheets;
}

export function driveClient() {
  if (!_drive) _drive = google.drive({ version: 'v3', auth: getAuth() });
  return _drive;
}

/**
 * Drive client via Service Account — untuk folder yang sudah di-share ke SA.
 * SA tidak bisa upload ke My Drive biasa (tidak punya storage quota).
 */
export function driveClientSA() {
  if (!_driveSA) _driveSA = google.drive({ version: 'v3', auth: getSAAuth() });
  return _driveSA;
}

/** Retry dengan exponential backoff untuk error kuota/transien Google API. */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const code = e?.code || e?.response?.status;
      if (code === 429 || code === 500 || code === 503) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
