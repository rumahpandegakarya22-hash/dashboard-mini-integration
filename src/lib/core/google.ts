import { google } from 'googleapis';

/**
 * Kredensial Google — mendukung DUA skema, dipilih otomatis saat runtime:
 *
 *   1. OAuth 2.0 refresh token (dipakai bila GOOGLE_CLIENT_ID +
 *      GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN ketiganya ada)
 *   2. Service Account JWT (fallback, skema lama)
 *
 * Kenapa dua-duanya hidup berdampingan, bukan langsung ganti:
 *
 * Aplikasi penghuni Teman Rara mengunggah berkas (bukti bayar, foto pengaduan,
 * scan KTP) memakai OAuth. Berkas itu DIMILIKI akun OAuth tersebut, sehingga
 * service account Ops tidak selalu bisa membacanya — padahal fitur verifikasi
 * bukti bayar & review pendaftaran wajib bisa. Menyamakan kredensial kedua app
 * menyelesaikan itu di akarnya.
 *
 * Peralihannya dibuat lewat environment (bukan perubahan kode) supaya bisa
 * dinyalakan dan dimatikan tanpa deploy ulang: cukup set/hapus tiga env OAuth.
 * Rollback ke service account = hapus GOOGLE_REFRESH_TOKEN.
 *
 * Refresh token WAJIB dibuat dengan dua scope sekaligus — `drive` dan
 * `spreadsheets` — karena klien di bawah ini melayani Drive maupun Sheets
 * (Sheets masih dipakai handler pembayaran-sewa untuk tabel harga invoice).
 */

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];

export function oauthTersedia(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

function getAuth() {
  if (oauthTersedia()) {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return auth;
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return new google.auth.JWT({ email, key, scopes: SCOPES });
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
