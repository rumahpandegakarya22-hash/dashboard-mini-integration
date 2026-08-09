import { google } from 'googleapis';

/**
 * Kredensial Google via OAuth 2.0 (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN).
 * Pengiriman email ditangani Brevo (BREVO_API_KEY) — tidak ada Gmail client di sini.
 * Token dibuat lewat: npx tsx scripts/gmail-token.ts
 */

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'];

export function oauthTersedia(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

function getAuth() {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

let _sheets: ReturnType<typeof google.sheets> | null = null;
let _drive: ReturnType<typeof google.drive> | null = null;

export function sheetsClient() {
  if (!_sheets) _sheets = google.sheets({ version: 'v4', auth: getAuth() });
  return _sheets;
}

export function driveClient() {
  if (!_drive) _drive = google.drive({ version: 'v3', auth: getAuth() });
  return _drive;
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
