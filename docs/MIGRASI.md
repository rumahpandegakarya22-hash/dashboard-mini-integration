# Log Migrasi — Dashboard Kost Tiga Dara → Next.js Terpadu

Log keputusan & penyimpangan selama eksekusi `RENCANA-MIGRASI-NEXTJS.md`.
Aturan §11.2.1: **port 1:1 dulu, refactor belakangan** — setiap penyimpangan
sadar dari perilaku lama WAJIB dicatat di sini sebelum commit.

| | |
|---|---|
| Repo basis | `miniapp-kost` (Next.js 16 + React 19 + TS) |
| Sumber port | `G:\Dashboard Mini App Integration\Dashboard Figma\` (read-only) |
| Repo terpadu | `G:\Dashboard Mini App Integration\kost-tiga-dara\` |
| Mulai | 20 Juli 2026 |

---

## Status Fase

| Fase | Judul | Status |
|---|---|---|
| 0 | Persiapan | ⚠️ Langkah 1–3 selesai; **gerbang TERBLOKIR** — lihat §0.6 |
| 1 | Fondasi struktur | ⬜ Belum |
| 2 | Port data layer Dashboard | ⬜ Belum |
| 3 | Port API & auth terpadu | ⬜ Belum |
| 4 | Port UI Dashboard | ⬜ Belum |
| 5 | Penyatuan lintas app | ⬜ Belum |
| 6 | Hardening, cutover & pembersihan | ⬜ Belum |

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

## Penyimpangan dari perilaku lama

_(Belum ada. Setiap entri wajib menyebut: apa yang berubah, mengapa, dampak ke
pengguna.)_
