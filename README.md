# Kost Tiga Dara — Dashboard & Mini App Operasional (terpadu)

Satu aplikasi Next.js 16 (App Router, TypeScript) yang melayani dua sisi:

| Prefix | Isi | Identitas visual |
|---|---|---|
| `/dashboard` | Dashboard analitik 5 role (owner, admin, marketing, operasional, sales) | dark "Liquid Glass", aksen mint, palet Owner crimson |
| `/ops` | Mini App Operasional — input harian staf (PWA, mobile-first) | warm-cream / crimson, light-first |
| `/login` `/sign-up` `/2fa` `/pending` | Layar auth bersama | mengikuti Ops |

Keduanya berbagi satu instance Clerk, satu database Turso, dan satu secret TOTP —
sehingga **satu login dan satu kali scan QR 2FA berlaku untuk keduanya**.

Hasil migrasi dari dua repo terpisah; log keputusan lengkap ada di
[`docs/MIGRASI.md`](docs/MIGRASI.md) dan daftar penyimpangan di
[`docs/PENYIMPANGAN.md`](docs/PENYIMPANGAN.md).

---

## Setup

1. **Node.js ≥ 20** (Next 16). Repo ini **wajib berada di drive NTFS** — exFAT
   tidak mendukung symlink/junction sehingga `next build` maupun `next dev`
   gagal total di sana.
2. `npm install`
3. `cp .env.example .env.local` lalu isi. Kunci per subsistem dijelaskan di
   dalam berkas contohnya.
4. **Clerk:** buat app di clerk.com → salin API Keys. Aktifkan metode login yang
   diinginkan (username/email + password, Google, Apple). Tambahkan webhook
   `{DOMAIN}/api/webhooks/clerk` untuk event `user.created` → salin Signing
   Secret. Tanpa webhook, akun baru tetap aman (default `pending`), hanya saja
   statusnya tidak eksplisit.
5. **Turso:** isi `TURSO_DATABASE_URL` & `TURSO_AUTH_TOKEN`.
6. **Google:** buat Service Account, aktifkan Sheets & Drive API, share seluruh
   spreadsheet dan folder Drive ke email service account (Editor; Database
   Penghuni cukup Viewer).
7. **Upstash Redis:** untuk lock, idempotensi, dan rate limit.
8. `npm run dev` → http://localhost:3000

Akun pertama: daftar lewat `/sign-up`, lalu jadikan Owner dengan
`npx tsx scripts/bootstrap-owner.ts <username>`.

---

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | server pengembangan |
| `npm run build` | build produksi |
| `npm run typecheck` | `tsc --noEmit` |
| `npx tsx scripts/golden-check.ts` | paritas data layer lama vs baru |
| `npx tsx scripts/contract-check.ts` | paritas kontrak API per role |
| `npx tsx scripts/access-matrix-check.ts` | matriks akses (dashboard/ops/keduanya/pending) |
| `npx tsx scripts/css-coverage-check.ts` | kelas komponen vs CSS tema |
| `npx tsx scripts/hydrate-check.ts` | cakupan hidrasi data dashboard |
| `npx tsx scripts/recompute-turso.ts [--commit]` | hitung ulang kolom formula ke Turso |
| `npx tsx scripts/dump-formulas.ts` | ekspor rumus asli spreadsheet (mengunci formula `[PENDING]`) |
| `npx tsx scripts/seed-occupancy-history.ts [--commit]` | isi occupancy_history |

---

## Struktur

```
src/
├── proxy.ts              clerkMiddleware — gerbang sesi kasar
├── config/               spreadsheets, akses & navigasi dashboard, palet, kolom
├── styles/               globals + theme-ops + theme-dashboard (ter-scope [data-app])
├── app/
│   ├── (auth)/           login, sign-up, 2fa, pending
│   ├── (dashboard)/      /dashboard/** — gating role dashboard
│   ├── (ops)/            /ops/**       — gating role ops
│   └── api/              health, webhooks, totp, dashboard/*, ops/*
├── components/
│   ├── ui/ charts/       primitif bersama (Table, Pagination, StatCard, chart SVG)
│   ├── dashboard/        shell, overview per role, halaman data
│   └── (akar)            komponen Ops (AppShell, DynamicForm, …)
└── lib/
    ├── core/             auth, roles, turso, google, sheets, redis, totp, audit
    ├── dashboard/        compute, sheet-map, source, rls, views/
    └── modules/          registry & handler modul Ops
```

Arah dependensi satu arah: `app/` → `components/` → `lib/dashboard` \| `lib/modules`
→ `lib/core` → `config/`. `components/ui` & `components/charts` tidak boleh
mengimpor dari `lib/`.

---

## Keamanan

- **Auth** Clerk; server tidak pernah menyimpan atau melihat password.
- **2FA TOTP kustom** (`speakeasy`) di atas sesi Clerk — MFA bawaan Clerk berbayar.
  Secret di `privateMetadata`, cookie step-up `ktd_2fa` ditandatangani `jose`,
  terikat `sessionId` sehingga tidak bisa dipakai ulang di sesi lain.
- **Dua namespace otorisasi** di satu instance Clerk: `role`/`status` (Dashboard)
  dan `miniappRole`/`miniappStatus` (Ops). Sengaja terpisah — akses satu sisi
  tidak otomatis memberi akses sisi lain.
- **RLS di server**: tab & kolom PII disaring per role, diterapkan **baik** di
  Route Handler **maupun** di jalur render halaman.
- **CSP & header keamanan** di `next.config.mjs`.
- Rate limit lewat Upstash Redis.

---

## Catatan operasional

- Database Penghuni bersifat **read-only** bagi app.
- Sebelum menulis ke Sheets, app memverifikasi kontrak header; struktur sheet
  yang diubah manual akan menolak penulisan.
- Jurnal sewa dimuka tetap digenerate menu "Kost Tools" di spreadsheet
  (Apps Script — lihat `docs/apps-script/`).
- Empat formula bertanda `[PENDING]` di `lib/dashboard/compute.ts` belum
  dikunci dari rumus asli spreadsheet; jalankan `scripts/dump-formulas.ts`.
