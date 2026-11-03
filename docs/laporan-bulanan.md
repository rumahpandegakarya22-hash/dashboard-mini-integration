# Laporan Bulanan Otomatis

11 laporan PDF per bulan (Properti A): 4 laporan pekerjaan divisi, Kerja Operasional, 5 laporan kinerja, dan Owner Review. Dibuat dari data Turso, diarsipkan ke Google Drive, dicatat di tabel `laporan_riwayat`.

## Status deploy (3 Nov 2026)

Sudah ter-deploy ke production lewat Vercel CLI (`vercel --prod`) ke proyek `dashboard-integrate-mini`, alias `https://dashboard-tiga-dara.vercel.app`. Build lolos dan rute `/api/cron/laporan-bulanan` ikut ter-build. Uji endpoint tanpa kunci dan dengan kunci salah: HTTP 401 JSON (tidak dialihkan ke login). Uji dengan kunci yang benar dijalankan lewat tombol Run di Vercel (Settings > Cron Jobs; `CRON_SECRET` bertipe Sensitive sehingga nilainya tidak bisa dibaca kembali): log runtime mencatat GET `/api/cron/laporan-bulanan` HTTP 200 pada 3 Nov 2026 18:39 UTC. Tidak ada baris riwayat baru (total tetap 18, Oktober tetap 11 baris), yaitu perilaku idempoten yang diharapkan karena Oktober sudah lengkap. Cara membaca log: `vercel logs --environment production --since 30m --json`.

Kode fitur sudah di-merge ke `main` GitHub (branch `feat/laporan-bulanan-otomatis`, 3 Nov 2026), jadi deploy production berikutnya dari Git sudah memuat laporan bulanan dan cron. Sebelum itu, deploy production dilakukan lewat Vercel CLI.

## Urutan deploy

Lakukan berurutan. Jangan deploy sebelum langkah 1-4 selesai.

1. **[SELESAI 3 Nov 2026 di produksi: 7 baris riwayat lama tersalin utuh, tabel cadangan `laporan_riwayat_lama` ada.]** Terapkan migrasi 019. Jalankan dulu tanpa `--commit` (dry-run), baca hasilnya, lalu:
   `npx tsx scripts/apply-schema.ts db/schema/019_laporan_riwayat_jenis_bebas.sql --commit`
   Migrasi mengganti nama tabel lama menjadi `laporan_riwayat_lama` (cadangan), membuat `laporan_riwayat` baru tanpa batasan jenis, dan menyalin isinya.
2. Cek `SELECT COUNT(*) FROM laporan_riwayat` sama dengan `SELECT COUNT(*) FROM laporan_riwayat_lama`. Bila sama, hapus tabel cadangan secara manual: `DROP TABLE laporan_riwayat_lama`.
3. **[SUDAH ADA di Vercel per 3 Nov 2026.]** Set `CRON_SECRET` di Vercel: Project > Settings > Environment Variables > Key `CRON_SECRET`, Value string acak (buat dengan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), Environment: Production, centang Sensitive. Lalu redeploy (env var baru hanya berlaku di deployment baru). Vercel mengirimnya sebagai `Authorization: Bearer ...` ke endpoint cron. Tanpa nilai ini cron selalu ditolak 401. Paket Hobby (gratis) cukup: cron boleh berjalan paling sering sekali sehari (jadwal kita sebulan sekali) dan waktunya hanya dijamin dalam jam yang sama (01:00-01:59 UTC).
4. Set kunci `app_config` untuk folder Drive tiap laporan, bentuk `drive_folder_laporan_<id>` (isi: ID folder Drive).
   - `owner-review`: **wajib**. Tanpa kunci ini Owner Review tidak diarsipkan ke Drive (sengaja tidak jatuh ke folder keuangan). **[SUDAH DISET 3 Nov 2026 di produksi ke folder Owner Review. Akses akun OAuth ke folder ini belum terverifikasi; scope Drive aplikasi adalah `drive.file`, jadi bila upload gagal dengan 404, bagikan folder ke akun Google yang dipakai OAuth atau buat folder lewat aplikasi.]**
   - Laporan lain: opsional. Bila kosong, memakai `DRIVE_FOLDER_LAPORAN`.
   Daftar id: `kerja-admin`, `kerja-keuangan`, `kerja-marketing`, `kerja-sales`, `kerja-operasional`, `kinerja-keuangan`, `kinerja-sales`, `kinerja-marketing`, `kinerja-operasional`, `kinerja-admin`, `owner-review`.
5. Deploy.
6. Dari panel Laporan Bulanan, generate manual satu laporan per keluarga (kerja, kinerja, owner) untuk bulan lalu, lalu buka PDF-nya dan periksa isinya.

Sebelum migrasi 019 diterapkan, generate gagal di langkah pencatatan riwayat dan tidak ada file yang dikirim ke Drive.

## Hasil uji generate (3 Nov 2026)

Semua 11 laporan dibuat untuk Oktober 2026 (11 berhasil, 0 gagal, 1-4 detik per laporan) dan tercatat di `laporan_riwayat` dengan `dibuat_oleh = 'Uji generate'`. Hanya Owner Review yang terunggah ke Drive (folder `drive_folder_laporan_owner-review`). Sepuluh laporan lain saat itu belum punya folder, sehingga baris riwayatnya tercatat tanpa tautan Drive. **Sudah diatasi:** pada 3 Nov 2026 kunci `drive_folder_laporan_<id>` untuk ke-10 laporan itu diisi dengan subfolder divisi di Drive (Laporan Kerja Divisi/{Admin, Finance, Marketing, operasional, Sales} dan Laporan Kinerja/{Admin, Keuangan, Marketing, Operasional, Sales}), masing-masing sudah diverifikasi (nama sesuai, bisa menambah file). Arsip Oktober sudah dilengkapi pada 3 Nov 2026: 10 PDF yang sama dengan yang tercatat diunggah ke folder masing-masing dan `drive_url` baris riwayatnya (id 8-17) diisi; semua 11 baris Oktober kini bertautan Drive.

## Cara kerja cron

- Jadwal di `vercel.json`: `0 1 1-3 * *` (UTC) = tanggal 1, 2, dan 3 pukul 08:00 WIB. Hari ke-2 dan ke-3 hanya mencoba ulang yang belum selesai: bila semuanya sudah ada dan email sudah terkirim, tidak ada yang dikerjakan lagi. Paket Hobby membolehkan cron paling sering sekali sehari.
- Membuat laporan bulan sebelumnya (WIB) untuk semua 14 laporan: 11 laporan divisi/owner plus 3 laporan keuangan (Arus Kas, Laba Rugi, Neraca; id `Cashflow`, `LabaRugi`, `Neraca`, sama dengan riwayat laporan keuangan lama dan tidak ditampilkan dobel di panel baru).
- Idempoten: laporan yang sudah punya baris di `laporan_riwayat` untuk periode itu dilewati. Menjalankan dua kali tidak membuat duplikat.
- Satu laporan gagal tidak menghentikan yang lain. Bila ada yang gagal, respons HTTP 500 dengan badan `{ periode, hasil }` (tiap item `dibuat`, `dilewati`, atau `gagal` beserta pesannya), sehingga Vercel menandai eksekusi gagal. Jalankan ulang: hanya yang gagal yang dibuat.
- Mengisi ulang bulan yang terlewat: panggil endpoint dengan `?periode=YYYY-MM` dan header `Authorization: Bearer <CRON_SECRET>`. Bulan berjalan ditolak (400).
- Baris riwayat dicatat sebelum upload Drive. Bila upload gagal, baris tetap ada tanpa tautan Drive dan cron tidak mengulanginya; buat ulang file lewat Pratinjau/Unduh PDF di panel.

## Email bulanan

Setelah semua laporan periode itu ada, cron mengirim **satu email** berisi PDF 13 laporan ke alamat "Email Tujuan Laporan" (pengaturan yang sama di halaman Laporan, disimpan di `app_config` kunci `laporan_email_to`):

- 3 laporan keuangan, 5 laporan kerja divisi, dan 5 laporan kinerja divisi. **Owner Review tidak ikut**: alamat tujuan bisa diubah staf admin/sales, sedangkan Owner Review hanya untuk owner. Untuk mengikutsertakannya, ubah aturan `email` di `registry.ts` (`l.keluarga !== 'owner'`).
- Pengirim memakai Brevo (variabel `BREVO_API_KEY` dan `BREVO_SENDER_EMAIL` di Vercel). Alamat tujuan kosong: email dilewati dan dicoba lagi pada cron hari berikutnya (tanggal 2 dan 3).
- Sekali per periode: penanda `laporan_email_terkirim_<YYYY-MM>` di `app_config` mencegah kiriman ganda. Untuk mengirim ulang periode tertentu, hapus penanda itu lalu panggil cron dengan `?periode=YYYY-MM`.
- Bila ada laporan yang gagal dibuat, email **ditunda** (respons 500, bagian `email.status = "ditunda"`) sampai semuanya berhasil pada jalankan berikutnya.
- Total lampiran dibatasi sekitar 3,5 MB per email (batas Brevo 4 MB). Bila lebih, otomatis dipecah menjadi beberapa email berlabel "(bagian 1/2)". Contoh uji Juni 2026: 13 berkas, 0,97 MB, satu email.
- Laporan yang sudah ada sebelumnya dirender ulang dari data saat ini untuk dilampirkan, jadi isi lampiran bisa sedikit berbeda dari arsip Drive bila data berubah setelah arsip dibuat.

## Bulan berjalan

Generate & Arsipkan (panel dan cron) menolak bulan berjalan karena datanya belum lengkap. Pratinjau dan Unduh PDF tetap bisa untuk bulan berjalan.

## Batas durasi fungsi Vercel

Endpoint cron memakai `maxDuration = 300` detik. 11 PDF berurutan butuh sekitar 1-2 menit. Bila paket Vercel membatasi lebih rendah (mis. 60 detik), eksekusi bisa terpotong; jalankan ulang cron (laporan yang sudah jadi dilewati) atau pecah per kelompok.

## Menjalankan pengecekan

- Test unit: `npm run test:laporan`
- Pengecekan data terhadap database (hanya membaca, tanpa menulis): `npx tsx scripts/laporan-bulanan-check.ts semua 2026-06`. Argumen: id laporan atau `semua`, periode `YYYY-MM`, opsi `--html <folder>` untuk menyimpan HTML, `--full`.
