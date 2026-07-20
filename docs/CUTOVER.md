# Checklist Cutover — Fase 6

Fase 6 hampir seluruhnya **tindakan manusia** (§11.4). Dokumen ini daftar
urutannya, apa yang harus dicek, dan cara mundur bila gagal.

Status: **belum dijalankan.** Kode siap, gerbang otomatis lulus; yang tersisa
UAT dan cutover oleh Owner.

---

## 0. Prasyarat sebelum mulai

| # | Item | Kenapa |
|---|---|---|
| 0.1 | Buat remote repo baru, `git remote add origin …` | Remote lama sengaja dilepas agar tidak ada risiko push ke repo Mini App lama |
| 0.2 | Token Turso **read-only** untuk golden test | §11.3 memintanya; yang dipakai sekarang read-write |
| 0.3 | Isi `DRIVE_FOLDER_ROLE_*` **bila** fitur "buat dokumen Drive" diinginkan | Fitur ini sudah mati sebelum migrasi; tanpa ENV ini ia tetap 503 |
| 0.4 | Putuskan 3 sel drift data Turso | Lihat `golden-report.md`; 2 di antaranya menyangkut akhir kontrak penghuni |
| 0.5 | Putuskan celah RLS admin ↔ Data Pembayaran | Lihat `PENYIMPANGAN.md` F3 |
| 0.6 | Jalankan `scripts/dump-formulas.ts` bila ingin mengunci 4 formula `[PENDING]` | Golden test membuktikan lama = baru, **bukan** bahwa formulanya benar |

---

## 1. UAT (Owner) — sebelum menyentuh produksi

Jalankan `npm run dev`, lalu uji dengan akun nyata.

### 1.1 Alur Ops (regresi Fase 1 — belum pernah diuji)

- [ ] login → beranda `/ops`
- [ ] satu submit modul **yang menulis ke Sheets/Drive** ← ini juga smoke test R5
      (`googleapis` 140 → 173); build hijau tapi panggilan runtime belum teruji
- [ ] joblist, ubah status
- [ ] `/ops/admin/users` (Owner)
- [ ] 2FA: setup → verify → disable
- [ ] bookmark/PWA lama: `/m/<modul>`, `/admin/users`, `/account` → harus 308 ke `/ops/...`

### 1.2 Dashboard — per role × halaman × tema (gerbang §9 Fase 4.6)

Untuk **tiap** role (owner, admin, marketing, operasional, sales), bandingkan
berdampingan dengan dashboard lama, pada tema **gelap** dan **terang**:

- [ ] overview: scorecard, chart, angka
- [ ] tiap halaman data di sidebar
- [ ] `/dashboard/akun`
- [ ] interaktif: filter periode, paginasi, sort kolom, filter kolom, tooltip chart
- [ ] approve/nonaktifkan akun (dua kolom: Dashboard & Ops)
- [ ] "buat dokumen Drive" — hanya bila 0.3 sudah diisi
- [ ] tautan "lupa password" di layar login
- [ ] konsol browser bersih (tanpa error / pelanggaran CSP)

> **Perubahan tampilan yang sudah diketahui & disengaja:** layar login berubah
> dari gelap ke terang, dan tabel yang sumbernya kosong kini menampilkan
> empty-state alih-alih data contoh. Lihat `PENYIMPANGAN.md` B1 & B2.

### 1.3 Matriks akses dengan akun nyata

- [ ] akun dashboard-only → `/` mendarat di `/dashboard`; `/ops` ditolak
- [ ] akun ops-only → `/` mendarat di `/ops`; `/dashboard` ditolak
- [ ] akun keduanya → mendarat di `/dashboard`, tautan silang muncul di kedua shell
- [ ] akun pending → `/pending`

---

## 2. Deploy preview (Vercel)

- [ ] Import repo ke Vercel
- [ ] Salin **seluruh** env dari `.env.local` ke Vercel (lihat `.env.example`)
- [ ] Deploy preview → ulangi §1 pada URL preview
- [ ] Cek `GET /api/health` → `{ ok: true }`

---

## 3. Cutover

Urutan ini penting: webhook diarahkan **setelah** domain, supaya tidak ada
jendela waktu di mana akun baru tidak tertandai `pending`.

1. [ ] Arahkan domain produksi ke deployment baru
2. [ ] Clerk Dashboard → Webhooks: arahkan **satu** endpoint ke
       `{DOMAIN}/api/webhooks/clerk`, **hapus** endpoint lama milik kedua app,
       pastikan `CLERK_WEBHOOK_SIGNING_SECRET` cocok
3. [ ] Clerk Dashboard → periksa konfigurasi SSO/OAuth (Google, Apple) untuk
       domain baru
4. [ ] Pantau `GET /api/health` dan log Vercel

### Umumkan ke pengguna sebelum cutover

> **Semua pengguna 2FA akan diminta memasukkan kode 6 digit sekali lagi**
> setelah cutover — baik pengguna Dashboard maupun Ops.
>
> Rencana semula memperkirakan hanya pengguna Ops yang terdampak. Kenyataannya
> lebih luas: nama cookie memang dipertahankan (`ktd_2fa`), tetapi algoritma
> tanda tangannya berubah (`jsonwebtoken` → `jose`), sehingga cookie lama tidak
> lolos verifikasi. **Secret TOTP tidak berubah — tidak perlu scan QR ulang.**

---

## 4. Setelah cutover

- [ ] Arsipkan repo lama (jadikan read-only, jangan dihapus)
- [ ] Simpan `docs/golden-*.json` di tempat aman **di luar git** — berisi PII
- [ ] Perbarui `MIGRASI.md` dengan tanggal cutover

---

## 5. Rencana mundur (rollback)

Rollback **murah** karena migrasi ini tidak menyentuh data sama sekali: skema
Turso, struktur Sheets, dan metadata Clerk tidak berubah.

1. Arahkan domain kembali ke deployment lama (masih utuh)
2. Kembalikan endpoint webhook Clerk ke konfigurasi lama
3. Selesai — **tidak ada migrasi data yang perlu dibatalkan**

Satu-satunya efek yang tersisa: pengguna memasukkan kode 2FA sekali lagi saat
kembali ke sistem lama, karena cookie step-up-nya berbeda format.

**Jangan** jalankan `scripts/recompute-turso.ts --commit` sebelum cutover
dinyatakan berhasil — itu satu-satunya skrip yang menulis ke data produksi.
