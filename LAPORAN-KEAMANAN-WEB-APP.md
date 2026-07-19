# Laporan Keamanan Web App
**Kost Tiga Dara — Mini App & Dashboard**
Tanggal audit: 18 Juli 2026 · Model: Fable 5

> Laporan ini menjawab 2 pertanyaan dari file *Mini App Improvement*, bagian **Keamanan Web App**:
> 1. Bagaimana sistem keamanan Web App ini dirancang? Apa yang dipertimbangkan, dan apa buktinya?
> 2. Audit keamanan: dari mana saja celah untuk di-*hack*? Sertakan buktinya.
>
> Semua bukti di sini diambil **langsung dari source code** (nama file + nomor baris), bukan asumsi. Ditulis dengan bahasa sederhana + analogi supaya mudah dipahami pemula.

---

## 0. Ringkasan Untuk Owner (Baca Ini Dulu)

**Kabar baik:** Kedua aplikasi dibangun dengan pondasi keamanan yang **kuat**. Tidak ada celah "Kritis" (yang bisa langsung dibobol orang asing dari internet), tidak ada password/kunci rahasia yang bocor ke publik, dan database aman dari serangan injeksi.

**Yang perlu dibenahi:** Ada beberapa celah tingkat **Sedang** — semuanya butuh seseorang yang **sudah punya akun** (staff, atau orang yang baru daftar), jadi bukan "pintu terbuka untuk orang asing", tapi tetap harus ditutup.

| Aplikasi | Nilai Keamanan | Celah Kritis | Celah Tinggi | Celah Sedang | Celah Rendah |
|---|---|---|---|---|---|
| 🟢 **Dashboard** | Sangat Baik | 0 | 0 | 2 | 5 |
| 🟡 **Mini App** | Baik | 0 | **1** | 3 | 4 |

**3 hal paling penting untuk dibenahi:**
1. 🔴 **[Mini App] 1 alamat data lupa dikasih penjaga** — orang yang baru daftar (belum Anda setujui) bisa menarik daftar penghuni + nomor HP. Perbaikan cepat, 3 baris kode.
2. 🟠 **[Mini App] "Diskon" & "harga disepakati" tanpa batas** — staff bisa mencatat pembayaran jadi hampir nol lewat diskon tak terbatas.
3. 🟠 **[Keduanya] Belum ada "batas kecepatan"** pada tombol Simpan/Preview — bisa di-spam sampai tagihan Google/Clerk membengkak.

---

# BAGIAN A — Bagaimana Sistem Keamanan Dirancang?

Anggap Web App ini seperti **sebuah gedung kantor**. Keamanan yang baik itu **berlapis** — bukan cuma satu pintu, tapi banyak pos penjagaan. Berikut lapisan-lapisan yang **sudah terpasang** di aplikasi Anda, beserta buktinya.

### Lapisan 1 — Satpam di Pintu Depan (Login lewat Clerk)
Kedua aplikasi tidak membuat sistem login sendiri (yang rawan salah), melainkan menyewa "jasa satpam profesional" bernama **Clerk**.

- **Yang dipertimbangkan:** Bikin login sendiri itu gampang bocor (salah simpan password, token gampang dipalsukan). Clerk sudah teruji dan mengurus password, sesi, dan verifikasi.
- **Bukti Dashboard:** `server/server.js:184-208` — setiap permintaan data dicek ke server Clerk (`clerkClient.users.getUser`), **bukan** cuma percaya pada label yang dikirim browser (yang bisa dipalsukan).
- **Bukti Mini App:** `src/lib/auth.ts` + `src/proxy.ts:12-15` — halaman & data dijaga fungsi `getSessionUser()`.

**Analogi:** Satpam tidak cukup lihat Anda pakai seragam. Dia telepon kantor pusat untuk memastikan Anda benar-benar karyawan.

### Lapisan 2 — Kunci Ganda (2FA / Kode dari HP)
Setelah login, ada lapisan kedua: kode 6 digit dari aplikasi *authenticator* (TOTP).

- **Bukti Mini App:** cookie 2FA ditandatangani secara digital & **diikat ke sesi login tertentu** (`src/lib/auth.ts:77-101`) — jadi tidak bisa "dicopot" lalu dipakai di sesi lain.
- **Bukti Dashboard:** `server/server.js:168-174` — cookie 2FA `httpOnly`, `secure`, ditandatangani.

**Analogi:** Sudah masuk gedung (login), masih harus scan sidik jari di lift (2FA) untuk naik ke lantai data.

### Lapisan 3 — Buku Tamu & Persetujuan Owner (Approval)
Orang baru yang mendaftar **tidak langsung bisa masuk**. Statusnya "menunggu" (`pending`) sampai Owner menyetujui.

- **Bukti Dashboard:** endpoint `GET/POST /api/users/*` (`server.js:320-360`) dijaga `requireOwner` — **hanya Owner** yang bisa menyetujui/menonaktifkan akun, dan dicek di server (bukan cuma disembunyikan di tampilan).
- **Bukti Mini App:** semua route `admin/users/*` mewajibkan `user.role === 'owner'`.

**Analogi:** Tamu baru duduk di ruang tunggu. Baru boleh masuk kalau Owner tanda tangan izin.

### Lapisan 4 — Setiap Staff Hanya Lihat Bagiannya (Role & PII)
Staff marketing tidak boleh lihat data yang bukan urusannya. Data pribadi penghuni (kontak darurat, email) disaring per jabatan.

- **Bukti Dashboard:** `server/server.js:397-407` — kolom data pribadi (`PII_COLS`) **dihapus** untuk staff biasa sebelum data dikirim.

**Analogi:** Kartu akses karyawan cuma bisa buka lantai divisinya, bukan seluruh gedung.

### Lapisan 5 — Kunci Rahasia Disimpan di Brankas, Bukan di Kode (Secrets)
Kunci database, kunci Google, token — semuanya disimpan di *environment variable* (brankas server), **tidak pernah ikut ter-upload ke GitHub**.

- **Bukti Mini App:** `.env.local` masuk daftar `.gitignore:3` (tidak ikut ter-*commit*). **Tidak ada** kunci ber-awalan `NEXT_PUBLIC_` (yang berarti bocor ke browser). Semua kunci hanya dibaca di kode server (`src/lib/turso.ts:12-13`, `src/lib/google.ts:4-5`).
- **Bukti Dashboard:** `git log` membuktikan file rahasia **tidak pernah** ter-commit; file `public/app.js` (yang dikirim ke browser) **tidak mengandung** kunci apa pun selain kunci publik Clerk yang memang boleh publik.

**Analogi:** Kunci brankas tidak ditempel di pintu depan. Ini persis permintaan Anda: *"Auth jangan di-post ke frontend."* ✅ Terpenuhi.

### Lapisan 6 — Database Anti-Bobol (SQL Aman)
Serangan paling umum ke database adalah "SQL Injection" — menyisipkan perintah jahat lewat kolom isian. Aplikasi Anda **kebal** ini.

- **Bukti:** semua perintah database memakai *parameter* (`?` + data terpisah), bukan menyambung teks dari user. Contoh Mini App: seluruh handler pakai `execute(sql, args)`. Dashboard: nama tabel hanya dari daftar tetap (`server/turso.js:15-20`), tidak dari input user.

**Analogi:** Formulir isian dan "mesin perintah" dipisah total. Apa pun yang ditulis penyerang di kolom nama, tetap dibaca sebagai nama, bukan perintah.

### Lapisan 7 — Pemeriksa Keaslian Pesan Otomatis (Webhook Signature)
Saat Clerk memberi tahu server "ada user baru", server **memverifikasi tanda tangan digital** pesan itu.

- **Bukti Mini App:** `src/app/api/webhooks/clerk/route.ts:26-33` — tanda tangan `svix` diverifikasi; kalau kunci kosong, langsung ditolak.
- **Bukti Dashboard:** `server/server.js:306-308` — pola yang sama.

**Analogi:** Server tidak percaya surat yang mengaku "dari Clerk" begitu saja — dia cek cap/segel aslinya dulu.

### Lapisan 8 — Perisai Tambahan
- **CSP & Security Headers** (Dashboard `server.js:150-160` + `vercel.json:11`): mencegah penyusupan skrip jahat.
- **Batas ukuran kiriman** 64 kb (`server.js:127`): mencegah kiriman raksasa membanjiri server.
- **Batas percobaan 2FA** 20x / 15 menit (`server.js:246-249`): mempersulit tebak-tebakan kode.

### Ringkas Rancangan
Aplikasi Anda menerapkan prinsip emas keamanan: **"Jangan pernah percaya pada browser (client)."** Login diverifikasi di server, rahasia disimpan di brankas, database anti-injeksi, dan akses dibatasi per jabatan. Ini rancangan yang **matang** — celah yang tersisa (Bagian B) bersifat spesifik, bukan cacat pondasi.

---

# BAGIAN B — Audit Celah Hack (Dengan Bukti)

Berikut daftar celah yang ditemukan, diurutkan dari yang paling penting. Tiap celah menjelaskan: **siapa yang bisa memanfaatkan**, **apa akibatnya**, **bukti** (file & baris), dan **cara memperbaiki**.

## 🟠 CELAH TINGGI

### [Mini App] H1 — Satu alamat data lupa dipasangi penjaga
- **Apa:** Alamat `GET /api/master/tenants` tidak memanggil pengecekan login lengkap seperti alamat lain — ia hanya mengandalkan "ada sesi Clerk", tanpa cek status disetujui / 2FA.
- **Siapa & akibatnya:** Siapa pun yang **baru mendaftar** (status masih "menunggu", belum Anda setujui), atau **mantan staff yang sesinya belum mati**, bisa menarik **seluruh daftar penghuni aktif lengkap dengan nomor HP**. Ini kebocoran data pribadi.
- **Bukti:** `src/app/api/master/[type]/route.ts:4-13` (tidak ada `getSessionUser()`, hanya komentar "dijamin proxy.ts"). Data sensitifnya: `src/lib/master.ts:164-186` (mengembalikan `nama`, `No. HP`).
- **Cara perbaiki (cepat, ~3 baris):**
  ```ts
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  ```
- **Bahasa awam:** Ada satu jendela belakang yang lupa dikunci — orang yang baru daftar (belum Anda izinkan) bisa mengintip daftar penghuni & nomor HP mereka. **Perbaiki ini paling pertama.**

## 🟡 CELAH SEDANG

### [Mini App] M2 — "Diskon" pembayaran tanpa batas → tagihan bisa jadi nol/minus
- **Siapa & akibatnya:** Staff admin yang mengisi pembayaran sewa bisa memasukkan **diskon melebihi total**, sehingga tercatat "Lunas" padahal nominalnya hampir nol atau minus. Bagusnya, harga sewa & DP **sudah** diambil dari data server (aman) — tapi diskon/pajak/denda diambil mentah dari isian tanpa batas.
- **Bukti:** `src/lib/modules/handlers/pembayaran-sewa-preview.ts:42-43` (`pajak`, `diskon` dari input), `:54-55` (denda); dipakai sebagai nominal final di `pembayaran-sewa.ts:170-172`.
- **Cara perbaiki:** Tolak di server jika `diskon > subtotal` atau `grandTotal <= 0`; diskon besar wajib persetujuan Owner.
- **Bahasa awam:** Staff bisa mengetik "diskon" sebesar apa pun sampai pembayaran tercatat nyaris gratis. Beri batas.

### [Mini App] M3 — "Harga disepakati" booking tidak dicek ke harga kamar asli
- **Siapa & akibatnya:** Saat input penghuni baru, kolom *harga disepakati* diterima apa adanya dari isian, **tanpa dibandingkan** ke harga resmi kamar. Staff bisa mencatat harga terlalu tinggi/rendah → laporan pendapatan melenceng. (Ini sebagian memang "harga nego", jadi solusi terbaik = **tandai/audit**, bukan blokir total.)
- **Bukti:** `src/lib/modules/handlers/penghuni-baru.ts:54` (`parseRupiah(values.hargaDisepakati)`), disimpan di `:97`. Validasi `src/lib/validate.ts:14-22` hanya menolak angka nol/negatif.
- **Cara perbaiki:** Bandingkan ke harga kamar; jika selisih di luar batas wajar (mis. ±10%), tandai untuk persetujuan Owner.
- **Bahasa awam:** "Harga deal" ditulis bebas oleh staff; sistem tak pernah mencocokkan ke tarif asli kamar.

### [Mini App] M4 — Tombol Simpan/Preview tanpa "batas kecepatan"
- **Siapa & akibatnya:** Pengguna login bisa menekan Simpan/Preview berkali-kali sangat cepat. Aksi simpan pembayaran memicu **kirim email invoice** lewat Google Apps Script (`pembayaran-sewa.ts:234-238`) dan menulis ke Google Sheets — bisa di-spam sampai kuota Google jebol / banyak email terkirim.
- **Bukti:** Fungsi pembatas `rateLimitOk` **ada** (`src/lib/redis.ts:35-40`) tapi hanya dipakai di upload & 2FA, **tidak** di `submit`/`preview`/`autofill`.
- **Cara perbaiki:** Tambahkan `rateLimitOk` di awal handler submit/preview, seperti yang sudah ada di upload.
- **Bahasa awam:** Tidak ada "batas kecepatan" pada tombol Simpan, jadi bisa di-spam sampai kuota/biaya Google membengkak.

### [Dashboard] M1 — Alamat data tanpa batas kecepatan + panggilan Clerk boros
- **Siapa & akibatnya:** Staff login (atau sesi yang dicuri) bisa menghantam `/api/sheets` & `/api/db` berulang. Tiap permintaan memanggil Clerk tanpa cache (`server.js:190`) → bisa membengkakkan tagihan Clerk & Turso.
- **Bukti:** Pembatas hanya di 4 route 2FA (`server.js:246-249`); `/api/sheets:430`, `/api/db:441`, `/api/me:238` tanpa pembatas.
- **Cara perbaiki:** Pasang `express-rate-limit` global untuk `/api/*`, dan cache hasil cek user Clerk ~30-60 detik.
- **Bahasa awam:** Staff bisa membuka-tutup halaman data super cepat sampai tagihan server naik; beri batas.

### [Dashboard] M2 — Satu alamat data belum menyaring data pribadi per kolom (rapuh)
- **Siapa & akibatnya:** `/api/sheets` sudah menyaring kolom data pribadi penghuni, tapi `/api/db` **hanya** menyaring per-tabel. **Saat ini aman** karena tabel `active_tenant` (berisi 2 kontak darurat + email) kebetulan tidak masuk daftar. Tapi kalau nanti tabel itu ditambahkan dengan nama mengandung "penghuni", staff junior bisa menerima **semua kolom termasuk email & kontak darurat**.
- **Bukti:** `server.js:417-426` (`filterTablesForRole`, tanpa hapus kolom) vs `:397-407` (`filterSheetsForRole`, sudah hapus PII). Tabel sensitif: `turso.js:19`.
- **Cara perbaiki:** Terapkan penyaringan kolom `PII_COLS` yang sama di `/api/db`.
- **Bahasa awam:** Satu pintu data sudah menyensor kontak pribadi penghuni, pintu satunya belum — aman sekarang, tapi satu perubahan kecil bisa membocorkannya ke staff junior.

## ⚪ CELAH RENDAH (Rapikan Saat Sempat)

| Kode | Aplikasi | Celah | Bukti | Bahasa Awam |
|---|---|---|---|---|
| L1 | Dashboard | File password lama menganggur di disk (`data/users.json`, `data/.jwt-secret`) — tak dipakai kode mana pun, tak pernah ter-commit | `.gitignore:6`, tak ada referensi kode | Sisa sistem login lama; **hapus** saja biar tak berisiko bocor nanti |
| L2 | Keduanya | Pesan error membocorkan detail internal (nama tabel/sheet) | Mini App `submit/route.ts:60` dll; Dashboard `server.js:436` dll | Pop-up error terlalu "cerewet" soal dalaman sistem; buat generik |
| L3 | Dashboard | `/api/health` publik memberi tahu konfigurasi backend (tanpa nilai rahasia) | `server.js:452-459` | Halaman status publik membocorkan cara backend dirakit; risiko kecil |
| L4 | Keduanya | Upload memercayai label tipe file dari browser | Mini App `upload/route.ts:56` | Upload menerima "label" tipe file dari browser apa adanya; cek isi aslinya |
| L5 | Dashboard | `TOTP_STEPUP_SECRET` bila kosong pakai kunci acak → user 2FA ditanya kode berulang (bukan celah bobol) | `server.js:87-92` | Kalau 1 setelan di Vercel kosong, user 2FA keganggu ditanya kode terus — pastikan sudah diisi |
| L6 | Mini App | Pembatas 2FA "fixed-window" izinkan sedikit burst (tak praktis dieksploitasi untuk 6 digit) | `src/lib/redis.ts:35-40` | Kunci tebak kode 2FA sedikit longgar, tapi tak realistis dibobol |

---

## Lampiran — Yang Sudah TERBUKTI AMAN (Tidak Perlu Diapa-apakan)

Supaya berimbang, ini hal-hal yang **sudah benar** dan dibuktikan saat audit:

- ✅ **Rahasia tidak ada di GitHub** — dicek dengan `git log`/`git ls-files`, file rahasia tak pernah ter-commit.
- ✅ **Tidak ada kunci di browser** — `public/app.js` (Dashboard) & bundle Mini App hanya berisi kunci publik yang memang boleh publik.
- ✅ **Database anti-injeksi** — semua query berparameter; input user tak pernah disambung ke perintah SQL.
- ✅ **Tombol khusus Owner benar-benar dijaga di server** (`requireOwner`), bukan sekadar disembunyikan di tampilan.
- ✅ **Webhook Clerk diverifikasi tanda tangannya** — pesan palsu ditolak.
- ✅ **Cookie 2FA ditandatangani & diikat ke sesi** — tak bisa dipakai ulang di sesi lain.
- ✅ **CSP & security headers terpasang**, ukuran kiriman dibatasi, percobaan 2FA dibatasi.
- ✅ **Tidak ada CORS terbuka lebar**, tidak ada `eval`, tidak ada `dangerouslySetInnerHTML`, tidak ada open-redirect.

---

## Prioritas Perbaikan (Urutan Kerja)

| Prioritas | Aplikasi | Tindakan | Usaha |
|---|---|---|---|
| **1** 🔴 | Mini App | Tambah cek login di `api/master/[type]` (H1) | ~3 baris, 5 menit |
| **2** 🟠 | Mini App | Batasi diskon & harga (M2, M3) di server | Kecil |
| **3** 🟠 | Keduanya | Pasang rate-limit pada submit/preview & `/api/*` (M4, M1) | Sedang |
| **4** 🟡 | Dashboard | Samakan penyaringan PII di `/api/db` (M2) | Kecil |
| **5** ⚪ | Keduanya | Hapus file lama, rapikan pesan error, cek env Vercel (L1-L5) | Ringan |

---

## Kesimpulan

**Pondasi keamanan kedua aplikasi sudah kokoh** — sesuai prinsip yang benar (jangan percaya browser, verifikasi di server, rahasia di brankas). Tidak ada lubang kritis yang bisa dibobol orang asing dari internet.

Celah yang ada bersifat **spesifik dan bisa ditutup cepat**, mayoritas hanya bisa dimanfaatkan orang yang **sudah punya akun**. Yang paling mendesak hanya **satu**: alamat data penghuni di Mini App (H1) yang lupa dipasangi penjaga — perbaikannya 3 baris. Sisanya adalah penguatan (batas diskon, batas kecepatan, penyaringan data) yang menutup potensi penyalahgunaan oleh staff dan mencegah tagihan membengkak.

Catatan penting: temuan audit ini **butuh validasi ulang oleh Anda** (sesuai permintaan di file improvement). Semua bukti sudah menyertakan nama file + baris, jadi bisa Anda telusuri sendiri atau minta saya perbaiki satu per satu.

---
*Audit dilakukan dengan membaca source code langsung (bukan asumsi), menggunakan metodologi keamanan untuk aplikasi web modern (auth, akses database, rate-limit, integritas pembayaran, kebocoran rahasia). Ini audit defensif atas aplikasi milik Anda sendiri.*
