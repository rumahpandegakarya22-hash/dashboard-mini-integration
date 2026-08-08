/**
 * Buat GMAIL_OAUTH_REFRESH_TOKEN untuk pengiriman invoice.
 *
 * Jalankan:  npx tsx scripts/gmail-token.ts
 *
 * Prasyarat di Google Cloud Console (proyek yang sama dengan service account):
 *   1. APIs & Services → Library → aktifkan "Gmail API".
 *   2. OAuth consent screen → User type External → isi nama app & email support.
 *      Di bagian "Test users", TAMBAHKAN alamat Gmail yang akan jadi pengirim.
 *   3. Credentials → Create credentials → OAuth client ID → Application type:
 *      "Desktop app". Salin Client ID & Client secret.
 *   4. Isi di .env.local:
 *        GMAIL_OAUTH_CLIENT_ID=...
 *        GMAIL_OAUTH_CLIENT_SECRET=...
 *
 * Script ini membuka server lokal sementara di http://localhost:53682 sebagai
 * redirect URI, jadi kode otorisasi tertangkap otomatis — tidak perlu copy-paste
 * kode dari URL. Hasil akhirnya satu baris GMAIL_OAUTH_REFRESH_TOKEN=... yang
 * kamu tempel sendiri ke .env.local dan Vercel (script ini sengaja TIDAK menulis
 * ke .env.local supaya file kredensialmu tidak disentuh otomatis).
 *
 * CATATAN PENTING soal masa berlaku: selama consent screen masih berstatus
 * "Testing", refresh token untuk akun @gmail.com kedaluwarsa dalam 7 hari dan
 * pengiriman invoice akan gagal dengan "invalid_grant". Untuk pemakaian
 * produksi, tekan "Publish app" di halaman OAuth consent screen — untuk scope
 * gmail.send yang sensitif, Google menampilkan layar peringatan "unverified"
 * saat otorisasi, tapi tokennya tidak lagi kedaluwarsa otomatis.
 */
import './_env';
import http from 'node:http';
import { google } from 'googleapis';
import { GMAIL_SCOPE } from '../src/lib/core/google';

/* Tiga mode:
     (default)  → scope gmail.send saja        → GMAIL_OAUTH_REFRESH_TOKEN
     --drive    → scope drive + spreadsheets    → GOOGLE_REFRESH_TOKEN
     --all      → drive + spreadsheets + gmail  → GOOGLE_REFRESH_TOKEN (SEMUA sekaligus)

   Pakai --all kalau tidak mau repot dua token: satu refresh token memegang
   semua akses (unggah Drive + kirim invoice). Aplikasi otomatis memakainya untuk
   Gmail juga (lihat gmailClient di core/google.ts). Ini yang dianjurkan — dua
   token terpisah gampang tertukar (drive dipaste ke slot gmail = 'insufficient
   authentication scopes' saat kirim invoice). */
const MODE_DRIVE = process.argv.includes('--drive');
const MODE_ALL = process.argv.includes('--all');
const DRIVE = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'];
const SCOPES_DRIVE = MODE_ALL ? [...DRIVE, GMAIL_SCOPE] : DRIVE;

const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}`;

async function main() {
  // Boleh memakai OAuth client yang SAMA untuk kedua mode; yang beda cuma scope
  // dan nama env hasilnya.
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('CLIENT_ID / CLIENT_SECRET belum ada di .env.local — lihat langkah 1-4 di komentar file ini.');
    process.exit(1);
  }

  const oauth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);
  const url = oauth.generateAuthUrl({
    access_type: 'offline', // wajib, kalau tidak Google tidak mengembalikan refresh token
    prompt: 'consent', // paksa consent supaya refresh token selalu ikut, bukan hanya saat otorisasi pertama
    scope: MODE_DRIVE || MODE_ALL ? SCOPES_DRIVE : [GMAIL_SCOPE]
  });

  console.log(
    MODE_DRIVE
      ? '\nBuka URL ini di browser, login dengan akun yang punya akses ke Shared Drive (folder DRIVE_FOLDER_*):\n'
      : '\nBuka URL ini di browser, login dengan akun Gmail PENGIRIM invoice:\n',
  );
  console.log(url);
  console.log('\nMenunggu otorisasi...');

  const code = await tungguKode();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    console.error('\nGoogle tidak mengembalikan refresh token. Cabut akses app ini di myaccount.google.com/permissions lalu ulangi.');
    process.exit(1);
  }

  // Nama env ikut mode: --drive menghasilkan GOOGLE_REFRESH_TOKEN (Drive+Sheets),
  // default menghasilkan GMAIL_OAUTH_REFRESH_TOKEN (gmail.send). Dulu di-hardcode
  // GMAIL_ sehingga token Drive gampang salah tempel.
  const namaEnv = MODE_DRIVE || MODE_ALL ? 'GOOGLE_REFRESH_TOKEN' : 'GMAIL_OAUTH_REFRESH_TOKEN';
  console.log('\nBerhasil. Tempel baris ini ke .env.local dan ke Environment Variables di Vercel:\n');
  console.log(`${namaEnv}=${tokens.refresh_token}\n`);
}

/** Server sekali pakai: tangkap ?code= dari redirect, balas halaman penutup, lalu mati. */
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
