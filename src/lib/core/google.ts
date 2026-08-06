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
 * Refresh token dibuat lewat `npx tsx scripts/gmail-token.ts --drive` dengan
 * scope `drive` + `spreadsheets`. Sejak 4 Agt 2026 TIDAK ADA modul yang membaca
 * Google Sheets lagi (harga kamar, penghuni, dan listrik semuanya dari Turso);
 * scope spreadsheets tetap diikutkan supaya token tidak perlu dibuat ulang
 * kalau suatu saat dibutuhkan.
 *
 * Pengiriman invoice lewat Gmail TIDAK ikut di sini: kredensialnya berdiri
 * sendiri (GMAIL_OAUTH_*, lihat gmailClient di bawah). Alasannya, jalur yang
 * aktif di produksi saat ini adalah service account, dan service account tidak
 * bisa mengirim email atas nama akun @gmail.com (butuh domain-wide delegation
 * yang hanya ada di Google Workspace). Memisahkannya juga berarti mengutak-atik
 * kredensial email tidak berisiko memutus akses Sheets/Drive yang sudah jalan.
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
let _gmail: ReturnType<typeof google.gmail> | null = null;

export function sheetsClient() {
  if (!_sheets) _sheets = google.sheets({ version: 'v4', auth: getAuth() });
  return _sheets;
}

export function driveClient() {
  if (!_drive) _drive = google.drive({ version: 'v3', auth: getAuth() });
  return _drive;
}

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export function gmailTersedia(): boolean {
  return Boolean(
    process.env.GMAIL_OAUTH_CLIENT_ID && process.env.GMAIL_OAUTH_CLIENT_SECRET && process.env.GMAIL_OAUTH_REFRESH_TOKEN
  );
}

/**
 * Klien Gmail dengan kredensial OAuth TERPISAH dari sheetsClient/driveClient.
 * Refresh token-nya dibuat lewat `npx tsx scripts/gmail-token.ts` dan hanya
 * memegang scope gmail.send — tidak bisa membaca inbox, tidak menyentuh Drive.
 */
export function gmailClient() {
  if (!gmailTersedia()) {
    throw new Error('Kredensial Gmail belum diisi (GMAIL_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN) — jalankan scripts/gmail-token.ts.');
  }
  if (!_gmail) {
    const auth = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GMAIL_OAUTH_REFRESH_TOKEN });
    _gmail = google.gmail({ version: 'v1', auth });
  }
  return _gmail;
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
