# Log Migrasi — Dashboard Kost Tiga Dara → Next.js Terpadu

Log keputusan & penyimpangan selama eksekusi `RENCANA-MIGRASI-NEXTJS.md`.
Aturan §11.2.1: **port 1:1 dulu, refactor belakangan** — setiap penyimpangan
sadar dari perilaku lama WAJIB dicatat di sini sebelum commit.

| | |
|---|---|
| Repo basis | `miniapp-kost` (Next.js 16 + React 19 + TS) |
| Sumber port | `D:\Dashboard Figma\` (read-only) — pindah dari G: yang tercabut, lihat §4.9 |
| Repo terpadu | `D:\kost-tiga-dara\` (dipindah dari G: — lihat §0.6) |
| Mulai | 20 Juli 2026 |

---

## Status Fase

| Fase | Judul | Status |
|---|---|---|
| 0 | Persiapan | ✅ Lulus (disetujui user 20 Juli 2026) |
| 1 | Fondasi struktur | ⚠️ Gerbang otomatis lulus; user mengizinkan lanjut, **UAT alur belum dijalankan** |
| 2 | Port data layer Dashboard | ✅ Gerbang lulus — golden test diff kosong (lihat `golden-report.md`) |
| 3 | Port API & auth terpadu | ✅ Gerbang lulus — uji kontrak identik utk 5 role |
| 4 | Port UI Dashboard | ⚠️ Langkah 1–5 selesai; **gerbang §9 Fase 4.6 menunggu UAT visual user** |
| 5 | Penyatuan lintas app | ✅ Gerbang lulus — matriks akses & build produksi hijau |
| 6 | Hardening, cutover & pembersihan | ⚠️ Pembersihan repo selesai; **cutover & UAT menunggu user** (`CUTOVER.md`) |

---

## Fase 0 — Persiapan

### 0.1 Pembuatan repo terpadu (riwayat git dipertahankan)

**Temuan yang mengubah langkah rencana:** akar repo git Mini App bukan
`miniapp-kost/` melainkan **folder induknya** (`Mini App/`), dengan
`miniapp-kost/` sebagai subdirektori. Menyalin folder biasa akan **membuang
seluruh riwayat git** — melanggar §9 Fase 0.1 ("jaga riwayat git Mini App").

Langkah yang dipakai (tanpa menyentuh repo sumber sama sekali):

```bash
git clone --no-hardlinks "…/Mini App" kost-tiga-dara   # klon lokal, repo sumber read-only
cd kost-tiga-dara
git subtree split -P miniapp-kost -b unified           # tulis ulang path → miniapp-kost jadi akar
git checkout unified && git branch -D master && git branch -m main
git remote remove origin                               # putus dari Mini-App-Operational.git
```

- Hasil: **20 commit** riwayat Mini App utuh dengan path sudah di-rebase ke akar.
- 3 dari 23 commit asli tidak menyentuh `miniapp-kost/` sehingga wajar tidak ikut.
- `origin` sengaja dilepas agar tidak ada risiko push tak sengaja ke repo Mini App
  lama. **Tindakan user:** buat remote repo baru lalu `git remote add origin …`.
- Repo sumber (`Mini App/`, `Dashboard Figma/`) **tidak dimodifikasi**; hanya
  ditambahkan pengecualian `safe.directory` di konfigurasi git global karena
  drive G: tidak merekam ownership.

### 0.2 Berkas kerja belum ter-commit yang ikut disalin

`git status` repo sumber menunjukkan delta di luar HEAD; disalin manual agar
repo terpadu identik dengan kondisi kerja terkini:

- `Mini App Improvement.txt` (termodifikasi)
- `LAPORAN-AUDIT-DATABASE-DAN-ALUR.md` (untracked)
- `LAPORAN-KEAMANAN-WEB-APP.md` (untracked)

Tidak disalin sesuai §1.3 / §11.1: `node_modules/`, `.next/`,
`tsconfig.tsbuildinfo`, `graphify-out/`, `next-env.d.ts` (regenerasi otomatis).

### 0.3 Deduplikasi `.env.local` (§11.1)

Sumber `G:\Dashboard Mini App Integration\.env.local` → `kost-tiga-dara\.env.local`.
34 kunci unik: **27 dipertahankan, 7 dibuang**.

**6 kunci ganda — seluruhnya diverifikasi byte-identical** (dibandingkan via
hash SHA-256, bukan mata), sehingga tidak ada ambiguitas yang perlu
dikonfirmasi user:

| Kunci | Baris | Verdikt |
|---|---|---|
| `TURSO_DATABASE_URL` | 1, 64 | identik |
| `TURSO_AUTH_TOKEN` | 2, 65 | identik |
| `TOTP_STEPUP_SECRET` | 3, 59 | identik |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 6, 56 | identik |
| `CLERK_SECRET_KEY` | 7, 57 | identik |
| `CLERK_WEBHOOK_SIGNING_SECRET` | 8, 58 | identik |

**7 kunci dibuang** (masing-masing diverifikasi dengan grep ke KEDUA codebase):

| Kunci | Alasan |
|---|---|
| `PUBLISH_KEY_CLERK` | alias lama; tidak dirujuk kode mana pun |
| `CLERK_PUBLISHABLE_KEY` | hanya dipakai `GET /api/config` Express yang **tidak di-port** (§5.3); `@clerk/nextjs` memakai `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |
| `JWT_SECRET` | legacy pra-Clerk. Verifikasi: satu-satunya rujukan adalah **fallback** di `src/lib/auth.ts:71` (`TOTP_STEPUP_SECRET \|\| JWT_SECRET`) yang tidak pernah aktif karena `TOTP_STEPUP_SECRET` di-set. Aman dibuang. |
| `GOOGLE_OAUTH_CLIENT_ID` | alur OAuth kustom pra-Clerk (`/api/auth/google/callback`) tidak ada di kedua codebase; OAuth ditangani Clerk |
| `GOOGLE_OAUTH_CLIENT_SECRET` | idem |
| `APP_BASE_URL` | idem — tidak dirujuk kode mana pun |
| `NODE_ENV` | Next.js menetapkannya sendiri (`dev`/`build`); menyetelnya di `.env` berisiko `development` bocor ke build produksi |

**Dipertahankan meski grep kode tidak menemukannya** — dibaca **implisit** oleh
`@clerk/nextjs`, jadi hasil grep menyesatkan: `NEXT_PUBLIC_CLERK_SIGN_IN_URL`,
`NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`.

Integritas: seluruh 27 nilai yang dipertahankan dibandingkan ulang byte-per-byte
terhadap sumber setelah penulisan → cocok 100%.

### 0.4 `.env.example` terpadu

Gabungan kedua `.env.example` lama, dikelompokkan per subsistem. Dibawa serta
dari contoh Dashboard: `CLERK_FRONTEND_API_ORIGIN` (opsional) — akan dipakai
untuk mempersempit CSP di Fase 5 (R7). Kunci usang didaftarkan eksplisit di
bagian bawah file agar tidak ditambahkan kembali.

### 0.5 Catatan untuk fase berikutnya

- **R5 (bentrok versi):** `package.json` basis masih `googleapis ^140` &
  `@libsql/client ^0.17.4`. Rencana §1.3 menargetkan `googleapis ^173`.
  Penaikan versi dilakukan di **Fase 1 langkah 3**, bukan sekarang, agar gerbang
  Fase 0 mengukur basis Mini App apa adanya.
- **§11.3 (golden test):** `TURSO_AUTH_TOKEN` yang tersedia saat ini adalah
  token **read-write** (`"a":"rw"`). Rencana meminta kredensial **read-only**
  untuk golden test Fase 2. **Tindakan user:** siapkan token read-only sebelum
  Fase 2 — golden test hanya membaca, tidak ada alasan memakai token tulis.
- Skrip bantu analisis env disimpan di scratchpad sesi (bukan bagian repo).

### 0.6 BLOKIR GERBANG — drive `G:` berformat exFAT, `next build` mustahil di sana

Gerbang Fase 0 (`npm run build` hijau) **tidak dapat lulus di lokasi kerja yang
ditetapkan §11.1**. Ini kendala lingkungan, bukan cacat kode.

**Bukti (semua diverifikasi langsung, bukan dugaan):**

| Uji | Hasil |
|---|---|
| `Get-Volume` drive G: | **exFAT** (D:, E:, A:, C: = NTFS) |
| Buat junction di `G:\` | **GAGAL** — `Incorrect function` (os error 1) |
| Buat junction di `C:\` (NTFS) | OK |
| `npm run build` (Turbopack, default Next 16) di `G:\…\kost-tiga-dara` | **GAGAL** — `failed to create junction point at ".next\node_modules\@libsql\client-…"` |
| `npx next build --webpack` (fallback) di G: | **GAGAL** — `EISDIR: illegal operation on a directory, readlink …/route.ts` |
| `npm run build` pada salinan identik repo di drive NTFS | **LULUS, exit 0** — 21 route ter-build |
| `npm run typecheck` di G: | LULUS (tsc tidak butuh symlink) |

**Sebab akar:** exFAT tidak mendukung symbolic link maupun NTFS junction point.
Next 16 membutuhkannya di `.next/node_modules/` (Turbopack) dan memanggil
`readlink` saat menelusuri route (webpack). **Kedua jalur build buntu** — tidak
ada opsi konfigurasi yang menghindarinya.

**Mengapa `Mini App/miniapp-kost/.next` terlihat seolah pernah ter-build di G::**
folder itu **hasil salinan**, bukan hasil build di tempat. Buktinya
`CreationTime` (20 Juli 00:34) **lebih baru** daripada `LastWriteTime`
(19 Juli 20:54) — tanda khas folder yang disalin — dan
`.next/node_modules/@libsql` berupa direktori biasa, bukan reparse point,
karena menyalin junction ke exFAT ikut mendereferensikannya. Mini App aslinya
tinggal di `A:\` (NTFS). Jadi **build belum pernah berhasil di G:**.

**Konsekuensi bila tidak dipindah:** bukan hanya `build` — `next dev` juga
menulis `.next`, sehingga pengembangan Fase 1–5 tidak bisa jalan sama sekali.

**Keputusan yang diminta ke user:** pindahkan **repo terpadu** `kost-tiga-dara`
ke drive NTFS. Folder sumber (`Dashboard Figma`, `Mini App`) **boleh tetap di
G:** — keduanya hanya dibaca dan tidak pernah di-build; skrip golden test §11.3
memakai Node biasa yang jalan normal di exFAT.

**Resolusi (disetujui user, 20 Juli 2026):** repo terpadu dipindah ke
**`D:\kost-tiga-dara`** (NTFS, 222 GB kosong; drive yang sama dengan repo
Dashboard lama `D:\Dashboard Figma`).

- Disalin **tanpa** `node_modules/` — instalasi di exFAT tidak dapat membuat
  symlink `.bin`, jadi dependensi di-install ulang bersih (`npm ci`) di NTFS.
- Riwayat git terverifikasi utuh setelah pindah: 20 commit, branch `main`,
  76/76 berkas `src/` cocok.
- Salinan di `G:\…\kost-tiga-dara` dihapus setelah verifikasi agar tidak ada
  dua sumber kebenaran.

**Peta path §11.1 yang diperbarui — pakai ini untuk seluruh fase berikutnya:**

| Path | Peran |
|---|---|
| `D:\kost-tiga-dara\` | **Repo terpadu** (pindah dari G: karena exFAT) |
| `G:\Dashboard Mini App Integration\Dashboard Figma\` | Referensi read-only, sumber port |
| `G:\Dashboard Mini App Integration\Mini App\miniapp-kost\` | Referensi read-only, basis |
| `G:\Dashboard Mini App Integration\.env.local` | Env gabungan asli (sudah dideduplikasi ke repo) |

Sesi Claude Code untuk fase berikutnya sebaiknya dibuka di `D:\kost-tiga-dara`
(atau tetap di G: dengan path absolut ke D: — keduanya jalan).

---

## Fase 1 — Fondasi struktur

### 1.1 Pemindahan (semua lewat `git mv`, riwayat per-berkas terjaga)

| Dari | Ke |
|---|---|
| `app/(app)/layout.tsx` | `app/(ops)/layout.tsx` (+ wrapper `data-app="ops"`) |
| `app/(app)/{page,m,admin,account}` | `app/(ops)/ops/…` |
| `app/{login,sign-up,2fa,pending}` | `app/(auth)/…` (URL tidak berubah — route group bukan segmen path) |
| `app/api/{submit,preview,autofill,edit,master,joblist,upload,admin}` | `app/api/ops/…` |
| `app/api/{totp,webhooks}` | tetap di akar — disatukan lintas app di Fase 3 |
| `lib/{auth,roles,turso,google,redis,audit,totp,validate}.ts` | `lib/core/…` |
| `app/globals.css` | `styles/globals.css` + `styles/theme-ops.css` |
| — (baru) | `app/api/health/route.ts`, `app/page.tsx` (root router sementara) |

28 rujukan path hardcoded diperbarui (fetch klien, `Link href`, perbandingan
`usePathname`). Redirect ke `/` **sengaja tidak diubah** (2FA & layar auth) agar
otomatis benar begitu root router Fase 3 mendispatch per akses.

### 1.2 Penyimpangan dari rencana — dengan alasan

**(a) `speakeasy` TIDAK dihapus** meski §9 Fase 1.3 mendaftarkannya bersama
`express`, `cookie-parser`, `jsonwebtoken`, `express-rate-limit` sebagai
"DIHAPUS". Verifikasi: `speakeasy` dipakai `lib/core/totp.ts` (generateSecret +
totp.verify) — ini implementasi 2FA Mini App yang justru jadi basis unifikasi
2FA di Fase 3. Menghapusnya akan mematikan 2FA kedua sisi. Yang benar dihapus
hanya 4 paket Express milik Dashboard, dan keempatnya memang tidak pernah ada di
`package.json` Mini App, jadi tidak ada aksi. Dugaan: daftar itu bermaksud
"speakeasy milik Dashboard tidak perlu ditambahkan lagi karena sudah ada".

**(b) `lib/sheets.ts` ikut pindah ke `lib/core/`** meski §3 tidak
mendaftarkannya di `core`. Alasan: `lib/core/audit.ts` (yang §3 tempatkan di
core) mengimpor `sheets.ts`. Membiarkan `sheets.ts` di `lib/` memaksa
`lib/core` mengimpor ke atas — melanggar arah dependensi §7. `sheets.ts` juga
memang infrastruktur murni (I/O Sheets + verifikasi kontrak header +
anti formula-injection), selapis dengan `google.ts` yang sudah di core.
Terverifikasi: `lib/core/` kini hanya mengimpor sesama isi `core/`.

**(c) Wrapper `(auth)` sementara memakai `data-app="ops"`.** Layar auth hari ini
adalah layar Mini App dan memakai kelas ops (blok "Login & sukses"). Tanpa
wrapper, token tidak resolve dan tampilan rusak. Fase 4 langkah 5 menyatukan
layar auth — wrapper ini diganti saat itu.

**(d) `color-scheme` tetap di `:root`,** tidak ikut di-scope. Properti ini
memengaruhi scrollbar & kontrol native seluruh halaman, jadi tidak bisa hidup di
`div` pembungkus tanpa mengubah tampilan. Perlu ditinjau ulang di Fase 4 saat
dashboard (dark-first) berdampingan dengan ops (light-first).

**(e) `name` di `package.json`**: `miniapp-kost` → `kost-tiga-dara`.

### 1.3 Pemecahan CSS — metode & bukti

`globals.css` (1.034 baris) dipecah **secara mekanis lewat skrip**, bukan
diketik ulang, supaya nol risiko salah transkripsi nilai. Skrip memverifikasi
batas baris dan gagal keras bila file tidak sesuai asumsi.

- `styles/globals.css` (93 baris): reset, tipografi/metrik dasar, `prefers-reduced-motion`,
  dan token yang benar-benar app-agnostic (z-scale + skala motion, sesuai §4).
- `styles/theme-ops.css` (963 baris): seluruh token warna/material/bentuk di-scope
  ke `[data-app='ops']`, override dark di-rescope ke
  `:root:not([data-theme='light']) [data-app='ops']`, plus seluruh kelas komponen.
- Latar & `color` app dipindah dari `body` ke wrapper `[data-app='ops']` — ini
  yang memungkinkan dashboard memakai latar gelapnya sendiri tanpa saling timpa.

Bukti pemecahan tidak menghilangkan apa pun:

| Uji | Hasil |
|---|---|
| Jumlah deklarasi CSS | 563 → 564 (+1 = `min-height:100dvh` sengaja ada di `body` global **dan** wrapper ops) |
| Nama token hilang | **0** |
| Token tema resolve di wrapper (dark) | `--bg #1f1d1c`, `--ink #f8f6f2`, `--brand #cf7b72` ✅ |
| Token tema resolve di wrapper (light, `data-theme='light'`) | `--bg #F8F6F2`, `--ink #3A3635`, `--brand #C92D31` — **identik palet asli** ✅ |
| Token bersama di `:root` | `--z-toast 60`, `--t-fast .15s`, `--ease-out` ✅ |
| **Kebocoran** `--bg`/`--brand` di `:root` & `body` | **kosong** ✅ — sifat inti yang membuat tema dashboard nanti tidak bentrok |
| Wrapper mewarnai latar ambient | ya (radial-gradient ter-render) ✅ |

### 1.4 Status gerbang Fase 1

Lulus otomatis:

| Uji | Hasil |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 — 28 route, struktur `/ops` & `/api/ops` sesuai §3 |
| Redirect 308 `/m/:id`, `/admin/users`, `/account` | 308 ke `/ops/...` ✅ |
| Gating `/ops`, `/ops/account` tanpa sesi | 307 → `/login` ✅ |
| `/api/health` publik | 200 tanpa sesi ✅ |
| Arah dependensi §7 (`lib/core` mandiri; `lib/` tidak impor `app/`/`components/`) | ✅ |
| Error konsol di layar publik | tidak ada |

**Belum bisa diverifikasi tanpa user** — butuh kredensial nyata, jadi masuk UAT
§11.4: alur login → beranda → satu submit modul → joblist → admin users → 2FA.
Termasuk di dalamnya smoke test **R5** (`googleapis` 140 → 173) pada panggilan
Sheets/Drive nyata: naik versi sudah dilakukan & build hijau, tetapi pemanggilan
runtime belum teruji.

---

## Fase 2 — Port data layer Dashboard

### 2.1 Yang di-port

| Sumber (repo lama) | Target | Metode |
|---|---|---|
| `server/compute.js` (267 baris) | `src/lib/dashboard/compute.ts` | verbatim + tipe; `FORMULA_CONFIG` & tanda [VERIFIED]/[LOOKUP]/[PENDING] utuh |
| `server/sheet-map.js` (172 baris) | `src/lib/dashboard/sheet-map.ts` | konversi **mekanis**; 172 pasangan (kolom,header) & 15 judul tab diverifikasi identik |
| `server/turso-source.js` + bagian baca `server/turso.js` | `src/lib/dashboard/source.ts` | verbatim; klien libSQL dipakai ulang dari `lib/core/turso.ts` |
| `SHEET_ACCESS` / `PII_COLS` (`server.js`) | `src/config/dashboard-access.ts` | regex verbatim |
| `filterSheetsForRole` / `filterTablesForRole` | `src/lib/dashboard/rls.ts` | verbatim, termasuk perilaku tepi |
| `server/inventory.js` | `src/lib/dashboard/inventory.ts` | verbatim |
| `server/{recompute-turso,seed-occupancy-history,bootstrap-owner,dump-formulas}.js` | `scripts/*.ts` (via `tsx`) | port; lihat penyimpangan 2.3 |

`scripts/recompute-turso.ts` mengimpor `lib/dashboard/compute.ts` yang **sama**
dengan runtime → duplikasi formula on-read vs on-write yang dulu dijaga manual
kini hilang (§3).

### 2.2 Gerbang: golden test — LULUS

Ringkas: ketiga perbandingan **byte-identical menurut SHA-256**. Rancangan uji,
tabel hash, kontrol negatif, dan temuan lengkap ada di **`docs/golden-report.md`**.

Yang perlu diketahui di luar "lulus":

- **File golden TIDAK di-commit** (masuk `.gitignore`). Isinya PII nyata 29
  penghuni termasuk kontak darurat pihak ketiga; menaruhnya di git = PII permanen
  di riwayat, ikut ke setiap clone dan ke GitHub bila di-push. Maksud §11.3
  (bukti paritas) dipenuhi lewat hash SHA-256 di `golden-report.md` — lebih kuat
  sebagai bukti dan nol PII. **Ini penyimpangan sadar dari §11.3.**
- **R5 terselesaikan secara empiris untuk permukaan baca**: lama memakai
  `@libsql/client` **0.14.0**, baru **0.17.4**, keluaran identik byte-per-byte.
  Permukaan Sheets/Drive (`googleapis` 140→173) masih menunggu UAT.
- **Drift data lama di Turso ditemukan** (3 sel, a.l. `er_persen = 2196428571`
  yang jelas rusak). Skrip lama melaporkan 3 sel yang sama → bukan regresi.
  **Tidak diperbaiki** karena §11.2.1 dan karena 2 di antaranya menyangkut akhir
  kontrak penghuni. Butuh keputusan user sebelum `recompute-turso.ts --commit`.

### 2.3 Penyimpangan dari rencana — dengan alasan

**(a) File golden tidak di-commit** — lihat 2.2 di atas.

**(b) `scripts/dump-formulas.ts` memakai jalur autentikasi berbeda.** Versi lama
memakai `data/service-account.json` atau `GOOGLE_SERVICE_ACCOUNT_JSON`; kedua
env itu dibuang saat deduplikasi Fase 0 karena tidak dipakai app. Skrip diadaptasi
memakai `lib/core/google.ts` (`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`)
yang memang kredensial aktif. Tanpa adaptasi ini skrip tidak akan bisa jalan.
Output pindah `data/` → `docs/`.

**(c) `scripts/bootstrap-owner.ts` memakai `@clerk/nextjs/server`,** bukan
`@clerk/express` (tidak ikut ke app terpadu). **Perlu perhatian di Fase 3:** skrip
ini memanggil `updateUserMetadata` dengan `publicMetadata: { role, status }` —
hanya namespace Dashboard. Di app terpadu ada namespace kedua
(`miniappRole`/`miniappStatus`) di objek `publicMetadata` yang sama. Perlu
diverifikasi apakah Clerk **menimpa seluruh** `publicMetadata` atau menggabung
per-key; bila menimpa, skrip ini akan menghapus akses Ops pengguna. Belum diuji.

**(d) `lib/dashboard/inventory.ts` vs `lib/inventory.ts`** — dua modul berbeda
dengan nama mirip sengaja dibiarkan: yang di `dashboard/` membaca **database**
Inventory Stock untuk pelaporan; yang di `lib/` memanggil **REST API** app
Inventory untuk modul pemakaian-stok Ops. Keduanya dipakai, bukan duplikat.

---

## Fase 3 — Port API & auth terpadu

### 3.1 Auth gabungan dua namespace

`lib/core/auth.ts` diperluas **secara aditif** — seluruh field lama (`signedIn`,
`status`, `needsTotp`, `totpEnrolled`, `user`) dipertahankan sehingga kode Ops
tidak berubah sama sekali. Ditambahkan: `opsRole/opsStatus`,
`dashboardRole/dashboardStatus`, `dashboardUser`, plus `getDashboardUser()`.

**Klaim kunci yang diverifikasi, bukan diasumsikan:** koeksistensi dua namespace
bergantung pada perilaku merge Clerk. Dokumentasi resmi mengonfirmasi
`updateUserMetadata()` melakukan **deep merge** (kunci dihapus hanya dengan
menyetel `null`); yang mengganti total adalah `replaceUserMetadata()`, yang tidak
dipakai di mana pun.

→ Ini **menutup risiko terbuka dari Fase 2 §2.3(c)**: `scripts/bootstrap-owner.ts`
yang menulis `publicMetadata: { role, status }` **AMAN** — tidak akan menghapus
`miniappRole`/`miniappStatus`.

2FA kini menjaga kedua sisi: `needsTotp` menyala bila akun aktif di **salah satu**
namespace, dan `getClerkSessionUser()` menerima aktif di salah satu sisi supaya
pengguna dashboard-only bisa setup/verify/disable TOTP.

### 3.2 Cookie step-up disatukan

| | Lama Dashboard | Lama Ops | Sekarang |
|---|---|---|---|
| Nama | `ktd_2fa` | `miniapp_2fa` | **`ktd_2fa`** |
| Tanda tangan | `jsonwebtoken` | `jose` HS256 | **`jose` HS256** |

Nama lama Dashboard dipakai sesuai §5.2 (mayoritas pemakai 2FA ada di sana).
Karena algoritma & payload mengikuti pola Mini App, cookie `ktd_2fa` lama terbitan
`jsonwebtoken` **tidak akan lolos verifikasi** — jadi realitanya **kedua** kelompok
pengguna verifikasi ulang sekali. Ini lebih luas dari perkiraan R4 (yang menduga
hanya pengguna Ops terdampak). Dampak tetap sama: satu kali input 6 digit.
Cookie `miniapp_2fa` usang dihapus otomatis saat step-up berhasil / 2FA dimatikan.

### 3.3 Endpoint yang dibangun (§8.1)

| Express lama | Baru | Catatan |
|---|---|---|
| `GET /api/me` | `GET /api/dashboard/me` | bentuk respons identik |
| `GET /api/db` | `GET /api/dashboard/db` | RLS + envelope identik |
| `GET /api/sheets` | `GET /api/dashboard/sheets` | idem |
| `GET /api/inventory` | `GET /api/dashboard/inventory` | |
| `POST /api/documents` | `POST /api/dashboard/documents` | lihat 3.5 |
| `GET /api/users` | `GET /api/dashboard/users` | array datar, field identik |
| `POST /api/users/{approve,disable}` | `POST /api/dashboard/users/{approve,disable}` | requireOwner + larangan menonaktifkan diri sendiri dipertahankan |
| `POST /api/webhooks/clerk` | `POST /api/webhooks/clerk` | **disatukan**: set pending di KEDUA namespace |
| `GET /api/config` | — | tidak di-port (§5.3) |

`lib/dashboard/api-guard.ts` memadankan `requireAuth`/`requireOwner`/`dataLimiter`,
dengan status code & teks pesan dipertahankan. Rate limit pindah ke Upstash
(120 req/60 dtk per user) menggantikan `express-rate-limit` in-memory.

### 3.4 Gerbang: uji kontrak — LULUS

`npx tsx scripts/contract-check.ts` membandingkan envelope respons lama vs baru
untuk kelima role, memakai snapshot RLS lama dari Fase 2 sebagai acuan:

| Role | `/api/dashboard/db` | `/api/dashboard/sheets` |
|---|---|---|
| owner | ✅ identik (16 tabel) | ✅ identik (16 tab) |
| admin | ✅ identik (6 tabel) | ✅ identik (7 tab) |
| marketing | ✅ identik (7 tabel) | ✅ identik (8 tab) |
| operasional | ✅ identik (6 tabel) | ✅ identik (7 tab) |
| sales | ✅ identik (7 tabel) | ✅ identik (8 tab) |

Uji HTTP langsung (tanpa sesi): ketujuh endpoint dashboard baru membalas **401**,
`/api/health` **200**, dan `/`, `/dashboard`, `/ops`, `/pending` mengarah ke
`/login`. Jalur ber-sesi nyata hanya bisa diuji lewat UAT §11.4.

**Perbedaan kontrak yang diterima:** permintaan tanpa sesi ke `/api/dashboard/*`
dicegat `proxy.ts` lebih dulu sehingga membalas `{"error":"Belum login."}`
(bertitik) alih-alih `{"error":"Belum login"}` milik Express. Status code sama
(401). Tidak diselaraskan karena satu pesan proxy melayani `/api/ops/*` juga,
yang kontrak lamanya justru bertitik. Tidak ada klien yang mem-parsing teks ini.

### 3.5 Temuan: fitur "buat dokumen Drive" sudah mati sebelum migrasi

`POST /api/documents` lama membaca peta folder dari `data/drive-config.json`.
**Berkas itu tidak ada di repo Dashboard**, sehingga endpoint SELALU membalas
503 `{ setup: true }` — fiturnya tidak berfungsi di deployment yang berjalan.

Port mempertahankan perilaku itu persis (503 bila belum dikonfigurasi), tetapi
sumber konfigurasi dipindah dari berkas ke ENV (`src/config/drive-folders.ts`):
filesystem Vercel read-only dan berkas di `data/` tidak ikut ter-deploy, jadi
berkas bukan mekanisme yang bisa jalan di target.

**Tindakan user bila fitur ini memang diinginkan:** isi
`DRIVE_FOLDER_ROLE_{OWNER,ADMIN,MARKETING,OPERASIONAL,SALES}` dengan ID folder
Drive yang sudah di-share ke `GOOGLE_SERVICE_ACCOUNT_EMAIL`. Selama kosong,
perilakunya sama persis dengan sekarang. Gerbang Fase 4 §9 menyebut uji "buat
dokumen Drive" — uji itu tidak akan bisa dilakukan tanpa ID folder tersebut.

### 3.6 Penyimpangan lain

- **`(dashboard)` placeholder dibuat lebih awal.** Router akar §5.2 mengarahkan
  pemilik akses dashboard ke `/dashboard`; tanpa halaman itu hasilnya 404. Dibuat
  layout ber-gating + halaman placeholder agar routing utuh & dapat diuji. UI
  sesungguhnya tetap pekerjaan Fase 4.
- **Fallback `JWT_SECRET` dihapus** dari `stepupSecret()` — env-nya sudah dibuang
  di Fase 0 dan fallback-nya tidak pernah aktif. Menyelaraskan kode dengan env.
- **Label TOTP** saat pendaftaran baru: `Kost Tiga Dara Mini App (...)` →
  `Kost Tiga Dara (...)`, karena 2FA kini melayani kedua sisi. Hanya memengaruhi
  entri authenticator yang didaftarkan setelah ini; secret lama tak tersentuh.
- **`totp/disable` kini menghapus cookie step-up** (`ktd_2fa` + `miniapp_2fa`),
  memulihkan paritas dengan `res.clearCookie(TOTP_COOKIE)` server.js lama yang
  tidak ada di implementasi Mini App. Respons juga menyertakan `tfaEnabled: false`
  seperti Express lama.

---

## Fase 4 — Port UI Dashboard (BERJALAN)

Fase terbesar (§9: 3–5 hari). Dikerjakan berlapis dari fondasi ke atas.

| Langkah §9 Fase 4 | Status |
|---|---|
| 1. `theme-dashboard.css` + pemetaan tema light ke `data-theme` | ✅ Selesai & terverifikasi |
| 2. `ui/Table`+`Pagination`, `charts/*`, `StatCard`, `Badge`, `ThemeToggle` | ✅ Selesai & terverifikasi |
| 3. `DashboardShell` (sidebar/topbar/period filter) | ✅ Selesai |
| 4. Halaman per role (5 overview → `[view]` → `akun`) | ✅ Selesai |
| 5. Layar `(auth)` final | ✅ Selesai |
| 6. Gerbang: checklist visual berdampingan | ⚠️ Bagian otomatis lulus; **UAT visual user belum** |

### 4.1 Port `styles.css` → `theme-dashboard.css`

Ditransformasi **mekanis lewat skrip** (bukan diketik ulang), hanya SELECTOR
yang diubah; nol nilai deklarasi disentuh (R8). Skrip melacak kedalaman kurung
agar `@keyframes` dan at-rule tidak ikut ter-prefix.

Pemetaan: `:root`/`body`/`html` → `[data-app='dashboard']`;
`body.theme-light X` → `:root[data-theme='light'] [data-app='dashboard'] X`;
`body:not(.theme-light) X` → `:root:not([data-theme='light']) …`;
`body[data-role="owner"]` → `[data-app='dashboard'][data-role="owner"]`
(wrapper route group kini membawa `data-role`).

**Tiga bug transformasi ditemukan & diperbaiki sebelum hasil dipakai** — semuanya
menghasilkan CSS yang diam-diam tidak berfungsi, bukan error yang terlihat:

1. `@media` ikut ter-prefix (`[data-app='dashboard'] @media …`) ketika didahului
   komentar → deteksi at-rule harus dijalankan SETELAH komentar dipisah.
2. Daftar selector multi-baris hanya baris terakhirnya yang termapping → pemisah
   `prefix` tidak boleh memotong pada newline terakhir.
3. `body.theme-light .role-tab` menjadi `[data-app='dashboard'].role-tab`
   (menempel, bukan keturunan) → penentu keturunan-vs-menempel adalah ADANYA
   SPASI DI SUMBER, bukan karakter pertama setelah trim.

Verifikasi hasil akhir: deklarasi 1317→1317, token 52→52, `@keyframes` 3→3,
kurung seimbang 404/404, 0 selector tak ter-scope, 0 at-rule ter-prefix,
0 `.theme-light` tersisa.

### 4.2 Bukti isolasi dua tema (diukur di DOM, bukan diasumsikan)

Wrapper dashboard disisipkan berdampingan dengan wrapper ops di halaman yang sama:

| | Dashboard | Ops |
|---|---|---|
| `--bg` | `#0b0c11` | `#1f1d1c` |
| `--brand` | `#8affc4` (mint) | `#cf7b72` |
| `--r-sm` | `14px` | `10px` |
| `--glass-blur` | `10px` (panjang) | `blur(22px) saturate(1.8)` (filter) |
| `--owner-brand` | `#c92d31` | — |

**Kebocoran: nol di ketiga arah** — tidak ada token tema di `:root`, token
dashboard tidak terbaca dari wrapper ops, token ops tidak terbaca dari wrapper
dashboard. Kelas komponen ikut aktif (`.card` → `border-radius: 22px` = `--r-card`).

Catatan: `--glass-blur` terbaca `10px`, bukan `30px` dari blok token pertama.
Ini **benar** — `styles.css` sumber punya blok `:root` kedua (baris 973,
"material pass, menang cascade") yang menimpanya. Cascade ter-port setia.

**Token bernama sama tetapi berbeda semantik** (`--glass-blur` panjang vs filter,
`--r-sm` 14px vs 10px) aman karena ter-scope terpisah, tetapi berarti cita-cita
§4.1 "satu kontrak nama token" belum tercapai penuh. Tidak diseragamkan karena
akan mengubah nilai visual (dilarang R8) — dicatat sebagai utang desain.

### 4.3 Penyimpangan: font Inter lewat `next/font`

`index.html` lama memuat Inter dari CDN Google Fonts. Di app terpadu dipakai
`next/font/google` (self-hosted). Tipografi yang ter-render identik (Inter,
bobot 400/500/600/700); yang berubah hanya cara pengambilannya.

Alasan: menghilangkan permintaan lintas-origin membuat CSP Fase 5 (R7) tidak
perlu melubangi `fonts.googleapis.com`/`fonts.gstatic.com`, sekaligus menghapus
satu titik gagal eksternal. Karena `next/font` menghasilkan nama family
ter-generate, literal `"Inter"` di `--font` dijembatani lewat
`styles/dashboard-font.css` dengan rantai fallback yang sama persis.
Berkas terpisah karena `theme-dashboard.css` dihasilkan ulang oleh skrip port.

### 4.4 Komponen bersama (langkah 2)

Semua di-port 1:1 dari `app.js`, mempertahankan **geometri SVG, nama kelas, dan
struktur markup** agar CSS hasil port berlaku tanpa perubahan.

| Sumber `app.js` | Target |
|---|---|
| `sparkline()` | `components/charts/Sparkline.tsx` |
| `donut()` | `components/charts/Donut.tsx` |
| `barChart()` | `components/charts/Bars.tsx` |
| `lineChart()` | `components/charts/AreaLine.tsx` |
| `funnel()` | `components/charts/Funnel.tsx` |
| `chartCard()` / `chartLegend()` / `emptyChart()` / `emptyCard()` | `components/charts/ChartCard.tsx` |
| `setupChartTooltip()` | `components/charts/ChartTooltip.tsx` |
| `table()` + `wireTable()` | `components/ui/Table.tsx` |
| `repage()` | `components/ui/Pagination.tsx` |
| `statCard()` / `statGrid()` / `glassify()` | `components/ui/StatCard.tsx` |
| `<span class="status">` yang tersebar | `components/ui/Badge.tsx` |
| toggle `#themeToggle` | `components/ui/ThemeToggle.tsx` |
| util format & tanggal (`fmtNum`, `parseDate`, `periodRange`, dst) | `lib/dashboard/format.ts` |

Perbedaan implementasi yang disengaja:

- **`esc()` tidak ikut di-port.** React meng-escape teks otomatis; mempertahankan
  `esc()` justru menghasilkan entitas ganda (`&amp;lt;`). `safeUrl()` TETAP
  dipertahankan karena React tidak memblokir skema `javascript:` pada `href`.
- **Tabel & paginasi jadi state React.** Versi lama menyaring/mengurutkan dengan
  memindahkan node `<tr>` dan menyetel `display:none`; kini turunan state dan
  hanya baris halaman aktif yang dirender. Perilaku yang tampak dipertahankan:
  sort `localeCompare('id',{numeric:true})`, jendela maks 5 nomor halaman,
  pilihan 10/20/30, teks "<n> data", empty-state yang menyebut periode.
- **Tooltip tidak lagi memakai `innerHTML`.** Isi callout masuk sebagai teks
  React, menutup jalur injeksi bila suatu saat ada label dari data pengguna.
  Kelas & tampilan (`.chart-tip`, `.chart-tip__dot`, `.chart-tip__lab`) sama.
- **`periodRange()`/`filterByPeriod()` menerima periode sebagai argumen**, tidak
  lagi membaca state global `cur` (§2.3: period/from/to jadi searchParams).

Kesalahan yang sempat terjadi & diperbaiki: toolbar tabel awalnya saya tulis
dengan nama kelas karangan sendiri (`.toolbar`, `.tbl-search`) yang **tidak ada
di CSS** — diganti mengikuti markup `toolbar()` asli (`.table-toolbar`,
`.tool-btn`, `<label class="search">`). Tanpa perbaikan ini toolbar tampil polos.

### 4.5 Verifikasi visual & interaksi (langkah 2)

Diuji lewat halaman pratinjau sementara yang **sudah dihapus lagi** setelah
pengecekan (tidak ikut ter-commit; entri publik sementara di `proxy.ts` juga
sudah dicabut).

Render & CSS mengenai komponen:

| Yang diukur | Hasil |
|---|---|
| Elemen ter-render | 4 stat card · 3 segmen donut · 5 batang · 15 titik line · 4 poligon funnel |
| `.card` border-radius | `22px` (= `--r-card`) |
| `.card` backdrop-filter | `blur(10px) saturate(1.85)` — kaca aktif |
| Latar & teks wrapper | `#0b0c11` / `#ededee` |
| Font | Inter (next/font) aktif |
| Paginasi | 10 dari 23 baris tampil, pager "23 data", 7 tombol |

Interaksi:

- **Tooltip chart**: hover segmen donut → `"Eco (Non AC) 12 · 41%"`, mengikuti
  kursor, hilang saat mouseout. Persentase dihitung benar.
- **Toggle tema**: `#0b0c11` → `rgb(219,227,242)` → kembali gelap, tersimpan di
  `localStorage['ktd-theme']`. Ini membuktikan pemetaan
  `body.theme-light` → `:root[data-theme='light']` berfungsi.

**Dua bug ditemukan lewat uji ini, keduanya sudah diperbaiki:**

1. **Hydration mismatch** — skrip anti-kedip memasang `data-theme` sebelum React
   hydrate, sehingga HTML server (tanpa atribut) berbeda dari DOM klien. Ini akan
   menimpa **setiap pengguna yang punya preferensi tema tersimpan**. Diperbaiki
   dengan `suppressHydrationWarning` pada `<html>` (cakupannya hanya atribut
   elemen itu).
2. **Peringatan React soal tag `<script>`** di dalam komponen → dipindah ke
   `next/script` `beforeInteractive`.

Setelah perbaikan, konsol **bersih tanpa error** pada tab baru.

### 4.6 Shell dashboard (langkah 3)

| Sumber `app.js` | Target |
|---|---|
| objek `ROLES` (navigasi saja) | `config/dashboard-nav.ts` |
| `buildSidebar()` + `buildTopbar()` + `pageHead()` | `components/dashboard/DashboardShell.tsx` |
| `periodFilter()` | `components/dashboard/PeriodFilter.tsx` |
| objek ikon `I` (yang dipakai shell) | `components/dashboard/icons.tsx` |

`config/dashboard-nav.ts` jadi **sumber tunggal** untuk sidebar SEKALIGUS guard
per halaman: `/dashboard/[view]` memanggil `canOpenView()` dan membalas 404 bila
view tidak terdaftar untuk role pemanggil — halaman tidak bisa bocor lewat URL
tebakan. `render:` dari objek `ROLES` lama tidak ikut ke config ini; pemetaan
view→komponen hidup di route, sehingga file config bisa diimpor Server Component
tanpa menyeret UI.

Perbedaan yang disengaja:

- **Navigasi memakai `<Link>` App Router**, bukan `<a href="#">` + state
  `cur.page`. Tiap halaman kini punya URL sendiri → bisa di-bookmark, tombol
  back berfungsi.
- **Periode pindah ke searchParams** (§2.3), bukan state global. Tampilan
  ter-filter jadi bisa di-share, dan Server Component membacanya langsung.
- **Tombol notifikasi & layar penuh dibiarkan dekoratif** — di `app.js` keduanya
  juga tidak punya handler. Tidak "diperbaiki" sesuai §11.2.1.
- `#refreshBtn` memuat ulang route; di sumber ia memanggil `loadLiveData()`.

Kesalahan yang sempat terjadi & diperbaiki: kelas `.sidebar-hidden` saya karang
sendiri padahal sumber memakai `.sidebar-collapsed`. Ditemukan lewat pengecekan
sistematis setiap nama kelas terhadap CSS hasil port — pemeriksaan yang sama
kini dijalankan untuk seluruh kelas shell (semua sisanya cocok).

**Belum diverifikasi visual**: shell hanya bisa dilihat dengan sesi login
dashboard, yang tidak tersedia untuk saya. Struktur & kelasnya sudah dicocokkan
ke CSS, tetapi tata letak sesungguhnya baru terbukti saat UAT.

### 4.7 Lapisan data halaman (langkah 4, bagian 1)

`loadLiveData()` app.js (~200 baris) di-port ke `lib/dashboard/views/`:

| Sumber | Target |
|---|---|
| `loadLiveData()` — hidrasi 11 tab | `views/hydrate.ts` |
| `recomputeFromPenghuni()` | `computeRoomsAndStats()` |
| `recomputeTempo()` | `computeTempo()` |
| variabel global (PENGHUNI, LEADS, …) | `views/types.ts` (tipe eksplisit) |

**Perbedaan mendasar:** di app.js ini semua variabel global yang dimutasi
berurutan; di sini fungsi murni yang MENGEMBALIKAN nilai. Tidak ada lagi urutan
panggil tersembunyi, dan seluruhnya bisa dijalankan di Server Component.

Deteksi tab & kolom tetap memakai **pencocokan header fuzzy** yang sama persis.
Itu disengaja: judul tab dan label kolom bisa bergeser di spreadsheet, dan
detektor longgar inilah yang membuat dashboard tidak langsung pecah.

**PENYIMPANGAN: data sintetis fallback TIDAK ikut di-port.** app.js punya
`PENGHUNI_RAW`, `logbookRows()`, `tiketRows()`, `logInspeksiRows()`, dll yang
membangkitkan baris palsu saat sumber kosong — data demo yang menyamar jadi data
nyata. Perilaku baru: sumber kosong → daftar kosong → empty-state. Ini
menghilangkan risiko angka fiktif tampil seolah data produksi.

#### Verifikasi terhadap data Turso nyata

`npx tsx scripts/hydrate-check.ts` menjalankan hidrasi atas keluaran
`readComputedSheets()` sesungguhnya — membuktikan detektor fuzzy benar-benar
mengenali tab yang dihasilkan `sheet-map.ts`, bukan sekadar lolos typecheck:

| Bagian | Baris | | Bagian | Baris |
|---|---|---|---|---|
| penghuni | 29 | | dokumen | 69 |
| logbook | 21 | | occupants | 32 |
| payments | 45 | | rooms | 29 |
| leads | 3 | | pembayaran | 45 |
| booking | 31 | | kamar | 29 |
| tiket | 3 | | vendor | 11 |

`STATS` = okupansi 100%, kapasitas 29, tunggakan 5 — lolos sanity check.
`RETENTION` = 32 total, 3 churned, rate 91%, rata-rata tinggal 6 bulan.
`TEMPO` = tunggakan 5, jatuh tempo 0, daftar 19.

Dua angka yang sempat terlihat janggal, keduanya sudah ditelusuri dan **benar**:

- **survey 0** — tab SURVEY memang 0 baris di Turso, bukan kegagalan deteksi.
- **vendor 11 dari 12 baris** — satu baris (id=4, kategori "Plumbing/Air") memang
  kosong kolom nama vendornya di Turso. Kode lama menyaringnya identik. Ini
  masalah kualitas data, bukan bug port.

### 4.8 Lima overview role (langkah 4, bagian 2)

| Sumber `app.js` | Target |
|---|---|
| `adminOverview()` … `salesOverview()` | `components/dashboard/overviews/*.tsx` |
| `computeFinance()` + `fmtRpShort`/`topEntries`/`shortAcct` | `views/finance.ts` |
| `seriesByDate()` | `views/finance.ts` |
| `donutBlock()` | `components/dashboard/DonutBlock.tsx` |
| objek `G`, `PAL`, `barStops*`, `OWN_BAR` | `config/dashboard-palette.ts` + `components/dashboard/BarStops.tsx` |
| objek `COLS` (105 pasangan kolom, 16 set) | `config/dashboard-cols.ts` (konversi mekanis, diverifikasi identik) |
| pemetaan `render:` objek `ROLES` | `overviews/OverviewFor.tsx` |

Overview dibuat **presentasional murni**: menerima data hasil hidrasi + hasil
`computeFinance`, tanpa fetch sendiri (§2.2). Pemuatan dilakukan
`views/load.ts` di Server Component.

#### RLS juga diterapkan di jalur halaman — bukan hanya di API

`views/load.ts` memanggil `filterSheetsForRole()` sebelum hidrasi. Ini **bukan**
duplikasi berlebih: halaman dashboard membaca Turso lewat jalur server langsung,
tidak lewat `/api/dashboard/sheets`. Tanpa filter di jalur ini, role marketing
akan melihat data keuangan di halamannya meskipun API-nya menolak.

Terverifikasi terhadap data nyata:

| role | leads | booking | tiket | vendor | keuangan |
|---|---|---|---|---|---|
| owner | 3 | 31 | 3 | 11 | 52 Jt |
| admin | 0 | 0 | 0 | 11 | 52 Jt |
| marketing | 3 | 0 | 0 | 0 | **NULL** |
| operasional | 0 | 0 | 3 | 11 | **NULL** |
| sales | 3 | 31 | 0 | 0 | **NULL** |

#### Verifikasi keuangan terhadap data nyata

`computeFinance` diuji pada beberapa periode: **Tahun ini** → pendapatan 52,4 Jt,
beban 5,2 Jt, laba 47,2 Jt, 6 bucket **bulanan**; **Bulan ini** → 17,4 Jt /
413 rb / 17,0 Jt, 12 bucket **harian**. Perpindahan bucket bulanan↔harian
(ambang 62 hari) berfungsi. Rincian OPEX wajar: Utilitas & Listrik 2,5 Jt,
Gaji Karyawan 1,8 Jt, Internet 456 rb.

#### Catatan port

- Fallback "Sisa Hari dari tab PENGHUNI" untuk Daftar Jatuh Tempo **tetap
  di-port** — itu jalur cadangan sah saat tabel `payment` belum terhidrasi,
  bukan data demo. Yang tidak di-port hanya pembangkit baris fiktif (§4.7).
- Scorecard Sales sengaja **tanpa filter periode** (metrik agregat lintas tahun);
  hanya grafik trennya yang ikut periode — perilaku sumber dipertahankan.
- CAC Marketing dan Response/Resolution Time Ops tetap "—" bila tak ada
  sumbernya, bukan angka karangan.

### 4.9 Drive sumber tercabut — port dilanjutkan dari salinan D:

Di tengah langkah 4, drive **`G:` (1 TB, exFAT) lenyap dari sistem** — hilang
sepenuhnya dari `Get-Volume`. Itu lokasi `Dashboard Figma/` yang jadi sumber port.

Ditemukan salinan di **`D:\Dashboard Figma\`** (lokasi asli menurut §1.1).
Salinan itu **tidak langsung dipakai** — memakai versi berbeda tanpa sadar akan
mencampur hasil port. Kesamaannya dibuktikan lebih dulu:

| Uji | Hasil |
|---|---|
| Jumlah baris `app.js` / `styles.css` | 2183 / 1099 — sama |
| Baris penanda 655, 768, 1002, 1224, 1797, 2094 `app.js` | isi identik dgn yang tercatat dari G: |
| `styles.css` baris 8 & 973 | identik |
| **Transformer CSS dijalankan ulang atas sumber D:** | keluaran **byte-identical** dgn `theme-dashboard.css` yang sudah ter-commit dari sumber G: |

Bukti terakhir bersifat menentukan: seluruh 1.317 deklarasi menghasilkan berkas
yang sama persis. Sumber D: = sumber G:. Port dilanjutkan dari `D:\Dashboard Figma\`.

### 4.10 Halaman data `[view]` (langkah 4, bagian 3)

| Sumber `app.js` | Target |
|---|---|
| `pagePenghuni` / `pagePenghuniSales` | `pages/ViewFor.tsx` (pilih set kolom per role) |
| `pagePembayaran` + filter nama | `pages/PembayaranPage.tsx` |
| `pageDokumen` + `dokumenRows` | `views/pages.ts` + `ViewFor` |
| `pageInventory` | `views/pages.ts:inventoryRows` + `ViewFor` |
| `rooms(variant)` + filter chip | `pages/Rooms.tsx` |
| `logbookForRole` + cabang 3-tabel Ops | `views/pages.ts` + `ViewFor` |
| `waBtn`/`openBtn`/`tagihanBtn` | `components/dashboard/CellButtons.tsx` |
| cabang sel `aksi`/`open`/`tagihan` di `table()` | `pages/DataTablePage.tsx` |

`DataTablePage` memisahkan renderer sel domain dari `ui/Table`, supaya `ui/Table`
tetap primitif bersama yang tidak bergantung ke lib domain (§7).

**Fallback sintetis TIDAK di-port** (instruksi user + §4.7): `dokumenRows()` hanya
memakai cabang data live; `tiketRows()`, `logInspeksiRows()`, `logPerbaikanRows()`,
dan `logbookOpsPage()` versi karangan tidak ikut sama sekali. Halaman Logbook
Operasional kini memakai cabang 3-tabel dari data live.

**Stok inventory dimuat kondisional** — hanya saat view `stok` dibuka, supaya
halaman lain tidak menanggung query ke DB app Inventory.

#### Verifikasi cakupan & isi

Cakupan: seluruh **35 kombinasi role × view** terbukti punya isi — tidak ada
halaman yang jatuh ke `null` dan tampil kosong tanpa error.

Jumlah baris nyata per role:

| role | halaman |
|---|---|
| admin | penghuni 29 · pembayaran **0** · vendor 11 · stok 22/0 · dokumen 20 · logbook 6 |
| marketing | leads 3+0 · dokumen 11 · logbook 3 |
| operasional | tiket 3 · vendor 11 · stok 22/0 · kamar 29 · dokumen 0 · logbook 9 |
| sales | prospek 0 · penghuni 29 · kamar 29 · dokumen 5 · logbook 3 |
| owner | penghuni 29 · kamar 29 · pembayaran 45 · stok 22/0 · dokumen 69 · logbook 21 |

Konsistensi logbook terverifikasi: 6+3+3+9 = 21 = total yang dilihat owner.

#### TEMUAN: Admin tidak bisa melihat Data Pembayaran (celah bawaan, BUKAN regresi)

`admin` punya menu **Data Pembayaran** tetapi menerima **0 baris**, sedangkan
owner menerima 45. Sebabnya `SHEET_ACCESS.admin` tidak punya regex yang cocok
dengan judul tab `PAYMENT (Pembayaran Sewa)` — `/keuangan|transaksi|jurnal|kas/`
tidak match.

Diverifikasi ke snapshot RLS Dashboard **lama** (`golden-old-rls.json`): tab
PAYMENT juga **tidak lolos** untuk admin di sistem lama. Jadi ini celah yang sudah
ada sebelum migrasi, bukan regresi port.

**Tidak diperbaiki** — §11.2.1 melarang "memperbaiki" saat port, dan mengubah
regex RLS adalah perubahan hak akses data yang harus diputuskan sadar oleh Owner.
**Keputusan user diperlukan:** apakah Admin & Keuangan memang seharusnya melihat
data pembayaran? Bila ya, tambahkan pola pada `SHEET_ACCESS.admin` di
`src/config/dashboard-access.ts` (mis. `/payment|pembayaran/i`).

Catatan kecil: DB Inventory berisi 22 bahan tetapi **0 transaksi** — tabel
"Mutasi Stok Terakhir" akan tampil kosong. Kondisi data, bukan bug.

### 4.11 Halaman Akun & Keamanan (langkah 4, penutup)

`/dashboard/akun` — port dari modal `openSecurityModal()` (`renderTfa` +
`renderOwnerUsers`), ditambah `DashboardUserAdmin.tsx` yang memanggil endpoint
Fase 3 (`/api/dashboard/users{,/approve,/disable}`).

Penyimpangan:

- **Modal → halaman ber-URL.** Di app.js ini modal dari ikon gembok; kini
  `/dashboard/akun` supaya bisa di-bookmark, di-back, dan di-deep-link.
- **`renderPassword()` TIDAK di-port.** Ganti password di app.js memanggil
  `clerk.user.updatePassword()` sendiri. Di app terpadu, seluruh pengelolaan
  password (ganti & lupa) ditangani komponen Clerk di layar auth — satu jalur,
  bukan dua yang harus dijaga sinkron.
- `TotpSettings` dipakai bersama sisi Ops: secret TOTP memang satu untuk kedua
  app (§5.2), jadi mengaktifkan 2FA di sini berlaku juga di `/ops`.

### 4.12 Layar auth final (langkah 5)

Layar auth sudah memakai komponen Clerk (`<SignIn>`/`<SignUp>`) warisan Mini App,
yang mencakup seluruh tuntutan §9 Fase 4.5. Terverifikasi ter-render di `/login`:
**password**, **Google**, **Apple**, tautan **daftar**.

**Belum terverifikasi:** tautan *lupa password* — Clerk menampilkannya pada
langkah entri password, yang tidak dapat dicapai tanpa username asli. Fitur ini
bawaan `<SignIn>` dan diatur di Clerk Dashboard, tetapi saya **tidak
mengklaimnya berfungsi** tanpa melihat sendiri. Masuk daftar UAT.

**KEPUTUSAN VISUAL yang perlu disadari:** layar auth memakai identitas **Ops**
(warm-cream), bukan dark-glass Dashboard. Alasannya: §2.1 menetapkan layar auth
disatukan sehingga hanya satu identitas bisa menang, dan §9 Fase 4.5 menetapkan
basisnya "Mini App". Merancang tema auth ketiga = mengarang nilai visual baru,
yang dilarang R8.

→ **Konsekuensi untuk pengguna Dashboard: layar login mereka berubah** dari gelap
menjadi terang. Kelas login lama (`.login-card`, `.login-role`, `.login-btn`)
kini tidak terpakai. Ini perubahan tampilan yang disengaja — bila Owner ingin
sebaliknya, keputusan itu harus diambil sadar sebelum cutover.

### 4.13 Gerbang Fase 4 — bagian otomatis LULUS, UAT visual BELUM

§9 Fase 4.6 menuntut checklist visual berdampingan (lama vs baru) per
role × halaman × tema, plus uji fungsi interaktif. **Gerbang ini belum lulus** —
sebagian besar isinya hanya bisa dikerjakan user.

Yang **sudah** terbukti otomatis:

| Uji | Hasil |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 — 38 route |
| Routing & gating tanpa sesi | `/`, `/dashboard`, `/dashboard/*`, `/ops`, `/pending` → `/login`; `/login`, `/sign-up`, `/api/health` → 200 |
| Cakupan view | 35 kombinasi role × view semuanya punya isi |
| RLS di jalur halaman | keuangan hanya sampai owner & admin |
| Error konsol di layar publik | tidak ada |
| Error server (dev log) | tidak ada |
| **Cakupan kelas CSS** | 112 dari 116 kelas ada di `theme-dashboard.css` |

Empat kelas yang "tidak ditemukan" (`sec-approve`, `sec-disable`, `sort-ind`,
`spark`) ditelusuri: keempatnya juga **0 aturan di `styles.css` lama** — memang
kelas tanpa gaya (hook event / penanda diisi teks). Port setia.

Uji cakupan CSS ini sengaja dibuat (`scripts/css-coverage-check.ts`) karena dua
kali selama Fase 4 saya mengarang nama kelas yang tidak ada di CSS
(`.toolbar`/`.tbl-search`, lalu `.sidebar-hidden`) — kesalahan yang **tidak**
tertangkap typecheck maupun build, hanya membuat elemen tampil tanpa gaya.

Yang **BELUM** dan hanya bisa user:

1. Perbandingan visual berdampingan lama vs baru, per role × halaman × tema.
2. Uji interaktif di halaman dashboard: filter periode, paginasi, sort, tooltip
   chart, approve akun — semuanya butuh sesi login yang tidak saya miliki.
3. "Buat dokumen Drive" — **tetap mustahil** sampai `DRIVE_FOLDER_ROLE_*` diisi
   (temuan Fase 3: fitur ini sudah mati sebelum migrasi).
4. Verifikasi tautan lupa password (lihat 4.12).

## Fase 5 — Penyatuan lintas app

### 5.1 Kelola Akun gabungan

`UnifiedUserAdmin.tsx` melebur dua panel terpisah (`renderOwnerUsers` Dashboard
dan `UserAdminPanel` Ops) jadi satu tabel dengan **dua kolom persetujuan**:
akses Dashboard dan akses Ops, masing-masing dengan role & status sendiri.

Dua kolom, bukan satu, karena §5.1 sengaja mempertahankan dua namespace: Owner
bisa memberi akses Ops tanpa akses Dashboard dan sebaliknya. Menyatukannya jadi
satu taksonomi adalah keputusan kebijakan bisnis, di luar scope migrasi.

Kedua endpoint yang sudah ada dipakai apa adanya lalu digabung di klien
berdasarkan `username` — **tidak** dibuat endpoint gabungan baru, supaya
masing-masing sisi tetap satu-satunya otoritas atas namespace-nya. Akses parsial
(Owner hanya di satu sisi) ditangani: kolom sisi lain menampilkan keterangan,
bukan error yang menutup halaman.

### 5.2 Navigasi silang

Tautan "Mini App Ops" di sidebar dashboard dan "Dashboard" di AppShell ops —
keduanya **hanya muncul bila akun benar-benar punya akses sisi lain**
(`hasOpsAccess` / `hasDashboardAccess` diturunkan dari `AuthState`), supaya
tidak menawarkan pintu yang terkunci.

### 5.3 CSP final (R7) & audit

CSP dipindah dari `vercel.json` ke `next.config.mjs headers()`. Perubahan
terhadap CSP lama, masing-masing karena sumber eksternalnya memang hilang:

| Perubahan | Alasan |
|---|---|
| **Hapus** `cdn.jsdelivr.net` dari `script-src` | app.js lama memuat SDK Clerk & pustaka QR dari CDN; kini paket npm ter-bundle |
| **Hapus** `fonts.googleapis.com` / `fonts.gstatic.com` | Inter self-hosted lewat `next/font` |
| **Tambah** `'unsafe-inline' 'unsafe-eval'` **hanya di dev** | HMR Next; tidak dipakai di produksi |
| **Tambah** `https://*.clerk.com` | instance produksi Clerk memakai domain itu. Bila `CLERK_FRONTEND_API_ORIGIN` di-set, origin spesifik dipakai — lebih sempit daripada wildcard |
| **Tambah** `blob:` pada `img-src` | QR 2FA dirender sebagai blob |
| **Tetap** `'unsafe-inline'` pada `style-src` | React menyuntik style inline (stat-card, chart); sama seperti CSP lama |

`frame-ancestors 'none'` + `X-Frame-Options: DENY` dipertahankan.

Diverifikasi: header benar-benar terkirim, dan halaman login tetap ter-render
penuh (Clerk ter-mount, tombol OAuth muncul) **tanpa satu pun pelanggaran CSP**
di konsol — inti kekhawatiran R7 (CSP terlalu ketat → halaman blank).

Audit §9 Fase 5.3: `express`, `cookie-parser`, `jsonwebtoken`,
`express-rate-limit`, `dotenv` **tidak ada** di `package.json` dan **nol
rujukan** di kode. Seluruh 27 kunci `.env.local` terpakai (4 di antaranya dibaca
implisit oleh `@clerk/nextjs`).

### 5.4 Gerbang — LULUS

Logika keputusan navigasi diangkat jadi fungsi murni di `lib/core/routing.ts`
(`resolveLanding`, `guardDashboard`, `guardOps`) yang dipakai **langsung** oleh
`app/page.tsx` dan kedua layout — jadi uji di bawah menguji kode produksi, bukan
salinan logika.

`npx tsx scripts/access-matrix-check.ts` — **7 kombinasi lulus**:

| kombinasi | akar | (dashboard) | (ops) |
|---|---|---|---|
| belum login | `/login` | `/login` | `/login` |
| pending kedua sisi | `/pending` | `/pending` | `/pending` |
| dashboard-only | `/dashboard` | boleh | `/pending` |
| ops-only | `/ops` | `/pending` | boleh |
| keduanya | `/dashboard` | boleh | boleh |
| 2FA belum step-up | `/2fa` | `/2fa` | `/2fa` |
| disabled kedua sisi | `/pending` | `/pending` | `/pending` |

Build produksi: **exit 0**. Golden test & uji kontrak dijalankan **ulang** atas
kode terkini — keduanya masih lulus, jadi Fase 4–5 tidak menimbulkan regresi
pada lapisan data maupun API.

---

## Fase 6 — Hardening, cutover & pembersihan

### 6.1 Pembersihan repo (selesai)

Seluruh artefak §1.3 terverifikasi **tidak ada**: `graphify-out/`, 12 folder
skill agen (`.cursor`, `.codex`, `.windsurf`, `.roo`, dst.), `desain.html`,
`api/index.js`, `vercel.json`, `railway.json`, `render.yaml`, `Procfile`.
`tsconfig.tsbuildinfo` dihapus (regenerasi otomatis, sudah gitignored).

`apps-script/` dipindah ke `docs/apps-script/` sesuai §3 — referensi, bukan kode
aplikasi; tidak ada rujukan kode ke sana.

`README.md` ditulis ulang sebagai README **gabungan**: kedua sisi, setup
Clerk/Turso/Sheets/Redis di satu tempat, daftar perintah verifikasi, peta
struktur, dan catatan keamanan. Termasuk peringatan **repo wajib di drive NTFS**.

### 6.2 Cutover — MENUNGGU USER

Seluruh sisa Fase 6 adalah tindakan manusia (§11.4) dan dirinci di
**`docs/CUTOVER.md`**: prasyarat, checklist UAT per role × halaman × tema,
deploy preview, urutan cutover, pengumuman ke pengguna, dan rencana mundur.

Poin yang wajib diumumkan sebelum cutover: **seluruh pengguna 2FA — Dashboard
maupun Ops — akan diminta kode 6 digit sekali lagi.** Secret TOTP tidak berubah,
jadi tidak perlu scan QR ulang.

Rollback murah: migrasi ini tidak menyentuh data sama sekali (skema Turso,
struktur Sheets, metadata Clerk tidak berubah), jadi cukup mengarahkan domain &
webhook kembali ke sistem lama.

---

## Penyimpangan dari perilaku lama

_(Belum ada. Setiap entri wajib menyebut: apa yang berubah, mengapa, dampak ke
pengguna.)_
