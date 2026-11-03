# Laporan Bulanan Otomatis

11 laporan PDF per bulan (Properti A): 4 laporan pekerjaan divisi, Kerja Operasional, 5 laporan kinerja, dan Owner Review. Dibuat dari data Turso, diarsipkan ke Google Drive, dicatat di tabel `laporan_riwayat`.

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

Semua 11 laporan dibuat untuk Oktober 2026 (11 berhasil, 0 gagal, 1-4 detik per laporan) dan tercatat di `laporan_riwayat` dengan `dibuat_oleh = 'Uji generate'`. Hanya Owner Review yang terunggah ke Drive (folder `drive_folder_laporan_owner-review`). Sepuluh laporan lain saat itu belum punya folder, sehingga baris riwayatnya tercatat tanpa tautan Drive. **Sudah diatasi:** pada 3 Nov 2026 kunci `drive_folder_laporan_<id>` untuk ke-10 laporan itu diisi dengan subfolder divisi di Drive (Laporan Kerja Divisi/{Admin, Finance, Marketing, operasional, Sales} dan Laporan Kinerja/{Admin, Keuangan, Marketing, Operasional, Sales}), masing-masing sudah diverifikasi (nama sesuai, bisa menambah file). Untuk melengkapi arsip Oktober, generate ulang laporan itu dari panel atau unggah PDF yang sudah ada dan isi `drive_url` barisnya.

## Cara kerja cron

- Jadwal di `vercel.json`: `0 1 1 * *` (UTC) = tanggal 1 pukul 08:00 WIB.
- Membuat laporan bulan sebelumnya (WIB) untuk semua 11 laporan.
- Idempoten: laporan yang sudah punya baris di `laporan_riwayat` untuk periode itu dilewati. Menjalankan dua kali tidak membuat duplikat.
- Satu laporan gagal tidak menghentikan yang lain. Bila ada yang gagal, respons HTTP 500 dengan badan `{ periode, hasil }` (tiap item `dibuat`, `dilewati`, atau `gagal` beserta pesannya), sehingga Vercel menandai eksekusi gagal. Jalankan ulang: hanya yang gagal yang dibuat.
- Mengisi ulang bulan yang terlewat: panggil endpoint dengan `?periode=YYYY-MM` dan header `Authorization: Bearer <CRON_SECRET>`. Bulan berjalan ditolak (400).
- Baris riwayat dicatat sebelum upload Drive. Bila upload gagal, baris tetap ada tanpa tautan Drive dan cron tidak mengulanginya; buat ulang file lewat Pratinjau/Unduh PDF di panel.

## Bulan berjalan

Generate & Arsipkan (panel dan cron) menolak bulan berjalan karena datanya belum lengkap. Pratinjau dan Unduh PDF tetap bisa untuk bulan berjalan.

## Batas durasi fungsi Vercel

Endpoint cron memakai `maxDuration = 300` detik. 11 PDF berurutan butuh sekitar 1-2 menit. Bila paket Vercel membatasi lebih rendah (mis. 60 detik), eksekusi bisa terpotong; jalankan ulang cron (laporan yang sudah jadi dilewati) atau pecah per kelompok.

## Menjalankan pengecekan

- Test unit: `npm run test:laporan`
- Pengecekan data terhadap database (hanya membaca, tanpa menulis): `npx tsx scripts/laporan-bulanan-check.ts semua 2026-06`. Argumen: id laporan atau `semua`, periode `YYYY-MM`, opsi `--html <folder>` untuk menyimpan HTML, `--full`.
