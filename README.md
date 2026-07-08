# Mini App Operasional Kost — Tiga Dara Putri UGM

Aplikasi input operasional harian (PWA, mobile-first) di atas Google Spreadsheet.
Referensi lengkap: `../PRD Mini App Operasional Kost v1.1.md`.

## Setup (sekali saja)

1. **Install:** `npm install` (butuh Node.js ≥ 18).
2. **Google Cloud:** buat project → aktifkan Google Sheets API & Google Drive API → buat Service Account → download key JSON → salin `client_email` dan `private_key` ke `.env.local`.
3. **Share akses:** share SEMUA spreadsheet (Log Sales, Log Input Transaksi, Generator Tagihan, Logbook Marketing/Feedback/Inspeksi, Log Laporan Inspeksi Perawatan Perbaikan) dan folder Drive upload ke email service account sebagai **Editor**. Database Penghuni cukup **Viewer** (app hanya membaca).
4. **Spreadsheet baru:** buat 3 spreadsheet: `Audit Log Mini App` (sheet "Log"), `Log Pindah Kamar` (sheet "Log"), `Log Checkout` (sheet "Log") → isi ID-nya di `.env.local`. Header akan ditulis otomatis oleh app saat pertama dipakai (atau lihat PRD §6).
5. **Upstash Redis:** buat database di upstash.com → salin REST URL & token ke `.env.local`.
6. **Env:** `cp .env.example .env.local` lalu isi semua nilai.
7. **Buat akun:** `node scripts/seed-user.mjs owner rahasia123 owner "Nama Owner"` (ulangi per staff).
8. **Jalankan:** `npm run dev` → buka http://localhost:3000. Deploy: push ke GitHub → import di Vercel → set env vars yang sama.

## Catatan penting

- **Database Penghuni = read-only.** App tidak pernah menulis ke sana (sheet DATA berformula/IMPORTRANGE).
- App menulis hanya ke kolom input; kolom formula di sheet tidak disentuh. Sebelum menulis, app memverifikasi header sheet (kontrak kolom) — jika struktur sheet diubah manual, penulisan ditolak.
- Jurnal sewa dimuka tetap digenerate menu "Kost Tools" di spreadsheet (Apps Script eksisting); app hanya mengisi sheet "Input Sewa Dimuka".
- Data cleansing pra-go-live: lihat PRD §13.

## Struktur

- `src/config/spreadsheets.ts` — ID semua spreadsheet.
- `src/lib/` — auth (JWT+Redis), sheets/drive helper, validasi, audit, RBAC.
- `src/lib/modules/` — registry & definisi 12 modul (form + handler).
- `src/app/` — halaman (login, menu, form modul) & API routes.
- `scripts/seed-user.mjs` — buat akun user.
