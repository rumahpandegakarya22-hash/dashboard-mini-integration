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
let _gmail: ReturnType<typeof google.gmail> | null = null;

export function sheetsClient() {
  if (!_sheets) _sheets = google.sheets({ version: 'v4', auth: getAuth() });
  return _sheets;
}

export function driveClient() {
  if (!_drive) _drive = google.drive({ version: 'v3', auth: getAuth() });
  return _drive;
}

/**
 * Drive client yang selalu pakai Service Account — untuk operasi write ke
 * folder yang sudah di-share ke SA (arsip invoice, upload dokumen ops).
 * Gunakan ini, bukan driveClient(), kalau tujuannya nulis ke folder kita sendiri
 * supaya tidak bergantung pada OAuth yang bisa expired/deleted.
 */
export function driveClientSA() {
  if (!_driveSA) _driveSA = google.drive({ version: 'v3', auth: getSAAuth() });
  return _driveSA;
}

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export function gmailTersedia(): boolean {
  const punyaGmailDedicated =
    process.env.GMAIL_OAUTH_CLIENT_ID && process.env.GMAIL_OAUTH_CLIENT_SECRET && process.env.GMAIL_OAUTH_REFRESH_TOKEN;
  // Token GOOGLE_* yang dibuat dengan --all juga memegang gmail.send, jadi bisa
  // dipakai kirim invoice tanpa kredensial Gmail terpisah.
  return Boolean(punyaGmailDedicated || oauthTersedia());
}

/**
 * Klien Gmail. Dua sumber kredensial, dipilih otomatis:
 *   1. GMAIL_OAUTH_* — token khusus scope gmail.send.
 *   2. GOOGLE_* — token utama, KALAU dibuat dengan `--all` (drive + spreadsheets
 *      + gmail.send). Jalur ini yang dianjurkan: satu token untuk semua, tidak
 *      ada dua token yang bisa tertukar.
 *
 * Kalau token GOOGLE_* dipakai tapi TIDAK punya scope gmail.send, Gmail menolak
 * saat kirim dengan "insufficient authentication scopes" — regenerate dengan
 * `npx tsx scripts/gmail-token.ts --all`.
 */
export function gmailClient() {
  if (!gmailTersedia()) {
    throw new Error(
      'Kredensial Gmail belum ada — jalankan `npx tsx scripts/gmail-token.ts --all` lalu isi GOOGLE_REFRESH_TOKEN.'
    );
  }
  if (!_gmail) {
    const pakaiDedicated = Boolean(process.env.GMAIL_OAUTH_REFRESH_TOKEN);
    const auth = new google.auth.OAuth2(
      pakaiDedicated ? process.env.GMAIL_OAUTH_CLIENT_ID : process.env.GOOGLE_CLIENT_ID,
      pakaiDedicated ? process.env.GMAIL_OAUTH_CLIENT_SECRET : process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({
      refresh_token: pakaiDedicated ? process.env.GMAIL_OAUTH_REFRESH_TOKEN : process.env.GOOGLE_REFRESH_TOKEN
    });
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
