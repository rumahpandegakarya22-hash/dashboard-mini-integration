/**
 * Generate GOOGLE_REFRESH_TOKEN untuk akses Google Drive.
 *
 * Jalankan:  npx tsx scripts/gmail-token.ts
 *
 * Prasyarat di Google Cloud Console (proyek yang sama dengan service account):
 *   1. APIs & Services → Library → aktifkan "Google Drive API".
 *   2. OAuth consent screen → User type External → isi nama app & email support.
 *      Di bagian "Test users", tambahkan akun Google yang punya akses folder Drive.
 *   3. Credentials → Create credentials → OAuth client ID → Application type:
 *      "Desktop app". Salin Client ID & Client secret.
 *   4. Isi di .env.local:
 *        GOOGLE_CLIENT_ID=...
 *        GOOGLE_CLIENT_SECRET=...
 *
 * Script ini membuka server lokal sementara di http://localhost:53682 sebagai
 * redirect URI, sehingga kode otorisasi tertangkap otomatis.
 * Hasil akhirnya satu baris GOOGLE_REFRESH_TOKEN=... yang kamu tempel sendiri
 * ke .env.local dan Vercel Environment Variables.
 *
 * Pengiriman email ditangani Brevo (BREVO_API_KEY) — tidak butuh scope Gmail.
 */
import './_env';
import http from 'node:http';
import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}`;

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET belum ada di .env.local — lihat langkah 1-4 di komentar file ini.');
    process.exit(1);
  }

  const oauth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);
  const url = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\nBuka URL ini di browser, login dengan akun Google yang punya akses ke folder Drive invoice:\n');
  console.log(url);
  console.log('\nMenunggu otorisasi...');

  const code = await tungguKode();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    console.error('\nGoogle tidak mengembalikan refresh token. Cabut akses app ini di myaccount.google.com/permissions lalu ulangi.');
    process.exit(1);
  }

  console.log('\nBerhasil. Tempel baris ini ke .env.local dan ke Environment Variables di Vercel:\n');
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
}

function tungguKode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const params = new URL(req.url || '', REDIRECT).searchParams;
      const code = params.get('code');
      const error = params.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<p style="font-family:sans-serif">${code ? 'Otorisasi berhasil. Tutup tab ini dan kembali ke terminal.' : `Gagal: ${error}`}</p>`);
      server.close();
      code ? resolve(code) : reject(new Error(error || 'kode otorisasi tidak diterima'));
    });
    server.listen(PORT);
  });
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
