# Penyimpangan dari `RENCANA-MIGRASI-NEXTJS.md`

Daftar terkonsolidasi **setiap** hal yang tidak sesuai rencana, beserta alasannya.
Rincian teknis tiap butir ada di `MIGRASI.md` pada fase terkait.

Aturan yang mengikat: §11.2.1 "port 1:1 dulu, refactor belakangan" — setiap
penyimpangan sadar wajib tercatat sebelum commit. Dokumen ini adalah ringkasan
tunggal untuk keperluan review Owner.

Legenda dampak:
**[U]** butuh keputusan/tindakan user · **[V]** mengubah tampilan ·
**[P]** mengubah perilaku · **[N]** netral (struktur/tooling)

---

## A. Rencana keliru — dikoreksi saat eksekusi

| # | Rencana menyatakan | Kenyataan | Tindakan |
|---|---|---|---|
| A1 | §9 Fase 0.1: "salin isi `miniapp-kost`" | Akar repo git ada di folder **induk**; salin biasa membuang 20 commit riwayat | `git subtree split` — riwayat utuh **[N]** |
| A2 | §9 Fase 1.3: `speakeasy` termasuk "DIHAPUS" | Dipakai `lib/core/totp.ts`; menghapusnya mematikan 2FA kedua sisi | Dipertahankan **[N]** |
| A3 | §11.1: lokasi kerja `G:\…` | `G:` berformat **exFAT** — Turbopack *dan* webpack sama-sama gagal build | Repo pindah `D:\kost-tiga-dara` **[U]** |
| A4 | R4: "hanya pengguna Ops verifikasi 2FA ulang" | Algoritma tanda tangan cookie berubah (`jsonwebtoken` → `jose`), jadi cookie `ktd_2fa` lama pun tidak lolos | **Kedua** kelompok verifikasi ulang sekali **[P] [U]** |
| A5 | §3: `lib/core` berisi 8 modul | `core/audit.ts` mengimpor `sheets.ts`; membiarkannya di luar melanggar arah dependensi §7 | `sheets.ts` ikut ke `core/` **[N]** |
| A6 | §11.3: simpan file golden di `docs/` | File berisi **PII nyata 29 penghuni** termasuk kontak darurat pihak ketiga | Di-gitignore; bukti diganti hash SHA-256 **[N]** |
| A7 | §9 Fase 4.6 gerbang menguji "buat dokumen Drive" | Fitur itu **sudah mati sebelum migrasi** (`data/drive-config.json` tidak ada) | Tidak dapat diuji sampai ENV diisi **[U]** |

---

## B. Keputusan yang mengubah tampilan **[V]**

| # | Perubahan | Alasan |
|---|---|---|
| B1 | **Layar login pengguna Dashboard berubah dari gelap ke terang** | §2.1 menyatukan layar auth — hanya satu identitas bisa menang; §9 Fase 4.5 menetapkan basisnya Mini App. Tema auth ketiga = mengarang nilai visual, dilarang R8. Kelas `.login-card`/`.login-role`/`.login-btn` jadi tidak terpakai. **[U]** |
| B2 | **Data demo/sintetis tidak di-port** | `PENGHUNI_RAW`, `logbookRows()`, `tiketRows()`, `logInspeksiRows()`, `logPerbaikanRows()`, `logbookOpsPage()` membangkitkan baris karangan saat sumber kosong — tak bisa dibedakan dari data nyata. Kini: sumber kosong → empty-state. **Diminta user secara eksplisit.** |
| B3 | Modal "Akun & Keamanan" → halaman `/dashboard/akun` | Agar bisa di-bookmark, di-back, di-deep-link |
| B4 | Font Inter dari CDN Google → `next/font` (self-hosted) | Tipografi identik; menghapus 2 origin eksternal yang harus dilubangi di CSP (R7) |
| B5 | Latar app pindah dari `body` ke wrapper route group | Prasyarat agar dua tema bisa hidup berdampingan tanpa saling timpa |

---

## C. Keputusan yang mengubah perilaku **[P]**

| # | Perubahan | Alasan |
|---|---|---|
| C1 | `renderPassword()` tidak di-port | Pengelolaan password (ganti & lupa) kini satu jalur lewat komponen Clerk, bukan dua jalur yang harus dijaga sinkron |
| C2 | Cookie step-up: `miniapp_2fa` → `ktd_2fa`, tanda tangan `jose` | §5.2. Lihat A4 untuk dampaknya |
| C3 | `totp/disable` kini menghapus cookie step-up | Memulihkan paritas `res.clearCookie()` Express yang **hilang** di implementasi Mini App |
| C4 | Rate limit `express-rate-limit` → Upstash Redis | §1.3 — in-memory tidak andal di serverless |
| C5 | Konfigurasi folder Drive: berkas `data/` → ENV | Filesystem Vercel read-only; berkas tidak ikut ter-deploy |
| C6 | Label TOTP baru: "Kost Tiga Dara" (tanpa "Mini App") | 2FA kini melayani kedua sisi. Hanya memengaruhi pendaftaran baru |
| C7 | Pesan 401 tanpa sesi: `"Belum login."` (bertitik) | Dicegat `proxy.ts` lebih dulu; satu pesan melayani `/api/ops/*` juga. Status code sama |
| C8 | Fallback `JWT_SECRET` dihapus | Env-nya dibuang di Fase 0; fallback tidak pernah aktif |

---

## D. Perubahan struktural **[N]**

| # | Perubahan |
|---|---|
| D1 | Navigasi `<Link>` App Router menggantikan `<a href="#">` + state `cur.page` — tiap halaman punya URL, bookmark & tombol back berfungsi |
| D2 | Periode pindah ke **searchParams**, bukan state global (§2.3) |
| D3 | Tabel & paginasi jadi state React, bukan memindahkan node `<tr>` + `display:none` |
| D4 | `esc()` tidak di-port (React escape sendiri); **`safeUrl()` tetap** karena React tidak memblokir `javascript:` |
| D5 | Tooltip chart tidak lagi memakai `innerHTML` — menutup jalur injeksi |
| D6 | `views/*` jadi fungsi murni; tidak ada lagi variabel global yang dimutasi berurutan |
| D7 | `render:` objek `ROLES` dipisah dari config navigasi agar config tetap data murni |
| D8 | `remote origin` dilepas dari repo terpadu **[U]** — user perlu membuat remote baru |
| D9 | `scripts/dump-formulas.ts` memakai kredensial service account aktif; jalur env lamanya dibuang di Fase 0 |
| D10 | `(dashboard)` placeholder dibuat lebih awal agar router akar §5.2 tidak berujung 404 |

---

## E. Utang yang belum lunas

| # | Perkara | Catatan |
|---|---|---|
| E1 | **§4.1 "satu kontrak nama token" belum tercapai** | `--glass-blur` (panjang vs filter) dan `--r-sm` (14px vs 10px) bertabrakan nama dgn semantik berbeda antara dashboard & ops. Aman karena ter-scope terpisah, tetapi bukan yang dicita-citakan. Tidak diseragamkan karena akan mengubah nilai visual (R8) |
| E2 | `color-scheme` tetap di `:root`, tidak ter-scope | Memengaruhi scrollbar & kontrol native seluruh halaman; tidak bisa hidup di `div` pembungkus tanpa mengubah tampilan |
| E3 | 4 formula `[PENDING]` belum dikunci | SLA maintenance, aturan durasi perbaikan, ROI promosi, sumber kategori arus kas. Golden test hanya membuktikan lama = baru, **bukan** bahwa formulanya benar. Perlu `scripts/dump-formulas.ts` **[U]** |

---

## F. Temuan pada sistem lama (bukan akibat migrasi)

| # | Temuan | Status |
|---|---|---|
| F1 | **3 sel drift data di Turso** — `er_persen = 2196428571` (jelas rusak) + 2 tanggal `tgl_keluar_est` | Skrip lama melaporkan hal sama. Tidak diperbaiki: menyangkut akhir kontrak penghuni **[U]** |
| F2 | **Fitur "buat dokumen Drive" sudah mati** — `data/drive-config.json` tidak ada, endpoint selalu 503 | Perilaku dipertahankan persis **[U]** |
| F3 | **Admin tidak bisa melihat Data Pembayaran** — `SHEET_ACCESS.admin` tak punya regex yang cocok dgn tab `PAYMENT (Pembayaran Sewa)`; menu ada, isinya 0 baris | Diverifikasi ke snapshot RLS lama: sama. Tidak diperbaiki — mengubah regex RLS = perubahan hak akses **[U]** |
| F4 | 1 baris vendor (id=4) kosong kolom nama di Turso | Kode lama menyaringnya identik |
| F5 | DB Inventory: 22 bahan, **0 transaksi** | Tabel "Mutasi Stok Terakhir" akan kosong |

---

## G. Kesalahan saya sendiri selama eksekusi (ditemukan & diperbaiki)

Dicatat agar dapat diaudit — semuanya sudah beres, tetapi menunjukkan di mana
uji otomatis tidak cukup.

| # | Kesalahan | Cara ketahuan |
|---|---|---|
| G1 | Transformer CSS: `@media` ikut ter-prefix bila didahului komentar | Pemeriksaan hasil per titik rawan |
| G2 | Transformer CSS: daftar selector multi-baris hanya baris terakhir yang termapping | idem |
| G3 | Transformer CSS: `body.theme-light .role-tab` jadi *menempel*, bukan keturunan → selector tak pernah cocok | idem |
| G4 | Verifikasi transformer saya sendiri terlalu longgar — melaporkan "0 masalah" padahal ada 24 | Pemeriksaan silang manual |
| G5 | Nama kelas dikarang: `.toolbar`/`.tbl-search` | Perbandingan ke CSS sumber |
| G6 | Nama kelas dikarang: `.sidebar-hidden` (seharusnya `.sidebar-collapsed`) | Pengecekan sistematis tiap kelas |
| G7 | **Hydration mismatch** dari skrip anti-kedip tema — menimpa setiap pengguna yang punya preferensi tersimpan | Uji render di browser |
| G8 | Peringatan React soal tag `<script>` dalam komponen | idem |
| G9 | **CSP produksi membuat SELURUH halaman blank** — `script-src` tanpa `'unsafe-inline'`/nonce memblokir 10 inline script hydration Next (`script-src-elem`). Dev lolos karena di sana `'unsafe-inline'` diizinkan untuk HMR, jadi bug hanya muncul di produksi | Uji `next start` mode produksi |

G9 adalah yang paling berbahaya: `npm run build` **exit 0**, dev server normal,
seluruh gerbang otomatis hijau — tetapi aplikasi produksi tidak menampilkan apa
pun. Perbaikannya nonce per-request di `proxy.ts` + `force-dynamic` pada halaman
yang sebelumnya statis, karena Next hanya bisa menyuntikkan nonce saat render
server (halaman statis dibuat saat build, tanpa header request).

G5 dan G6 **tidak tertangkap typecheck maupun build** — hanya membuat elemen
tampil tanpa gaya. Karena itu dibuat `scripts/css-coverage-check.ts` yang kini
memverifikasi 116 kelas komponen terhadap CSS.

---

## H. Peristiwa lingkungan

| # | Peristiwa | Penanganan |
|---|---|---|
| H1 | Drive `G:` (1 TB, exFAT) **lenyap** di tengah Fase 4 — lokasi sumber port | Salinan `D:\Dashboard Figma` dipakai **hanya setelah** kesamaannya dibuktikan: jumlah baris, isi 6 baris penanda, dan transformer CSS dijalankan ulang menghasilkan berkas **byte-identical** |
| H2 | `G:` exFAT tidak mendukung symlink/junction | Repo pindah ke NTFS (lihat A3) |
| H3 | Git menolak repo di `G:` (dubious ownership) | `safe.directory` ditambahkan |
