# Bagian A. Untuk semua role {#bagian-a}

Bagian ini dibaca semua orang, apa pun role-nya. Isinya pengenalan aplikasi, cara masuk, dan aturan yang berlaku untuk semua form. Setelah itu, loncat ke bagian role-mu di Bagian B.

## A1. Aplikasi yang ada {#a1}

Ada tiga aplikasi di satu alamat web, ditambah dua aplikasi di luar yang tersambung.

| Aplikasi | Alamat | Fungsinya |
|---|---|---|
| Dashboard | `/dashboard` | Melihat angka dan grafik. Tidak untuk mengisi data harian. |
| Mini App Operasional | `/ops` | Tempat staf mengisi data harian: pembayaran, survey, leads, perawatan, inspeksi, dan sebagainya. Nyaman dipakai di HP. |
| Inventory Stock | `/inventory` | Mencatat stok bahan dan alat: belanja, pemakaian, opname. |
| Teman Rara | aplikasi terpisah | Aplikasi untuk penghuni: daftar mandiri, bukti bayar, pengaduan, pengajuan checkout, pengumuman, dan WiFi. Datanya masuk ke database yang sama dengan Mini App, jadi pengelola menanganinya dari Mini App. Penjelasan lengkap ada di bagian C7. |
| Landing page | aplikasi terpisah | Situs publik kost. Dikelola lewat tautan Setting Landing Page. |

Satu akun dan satu kali scan 2FA berlaku untuk Dashboard dan Mini App. Dari sidebar ada bagian Aplikasi Lain untuk berpindah antar aplikasi. Tautan yang muncul hanya yang boleh kamu buka.

Alur data singkatnya: staf mengisi form di Mini App atau Inventory, data tersimpan di database, lalu Dashboard dan laporan bulanan membaca database yang sama. Karena itu angka di Dashboard hanya akurat kalau form harian diisi tepat waktu.

## A2. Memulai {#a2}

### Daftar akun

1. Buka halaman daftar, isi data, dan buat akun.
2. Setelah daftar, kamu akan melihat layar Menunggu Persetujuan. Akun baru memang belum bisa dipakai.
3. Hubungi Owner. Owner mengaktifkan akunmu dan menentukan role-mu lewat menu Kelola User (di Mini App) atau halaman kelola akun di Dashboard.
4. Setelah disetujui, keluar lalu masuk lagi.

Hak akses Dashboard dan hak akses Mini App diatur terpisah. Punya satu belum tentu punya yang lain. Kalau kamu bisa masuk ke Mini App tapi Dashboard menolak, minta Owner membuka akses Dashboard-mu.

### Aktifkan 2FA (Google Authenticator)

2FA adalah kode 6 digit yang berganti terus di HP. Gunanya mengamankan akun kalau password bocor.

1. Buka Keamanan Akun (ikon perisai di sidebar atau dock bawah).
2. Scan QR yang tampil dengan aplikasi Google Authenticator.
3. Masukkan kode 6 digit yang muncul di aplikasi.
4. Mulai sekarang, setiap masuk kamu akan diminta kode itu.

Satu kali scan cukup untuk Dashboard dan Mini App. Kalau mau ganti HP, pindahkan akun di Google Authenticator ke HP baru sebelum HP lama dihapus. Kalau HP sudah hilang, hubungi Owner atau pengelola sistem.

### Tampilan di HP dan komputer

Di HP, menu ada di dock bawah (Beranda, Pengaturan, Akun, Keluar) dan tombol garis tiga di pojok kanan atas untuk membuka menu penuh. Di komputer, menu ada di sidebar kiri. Isinya sama.

Di Dashboard, tombol muat ulang di bagian atas memuat ulang data. Pakai itu kalau kamu baru menyimpan data tapi angkanya belum berubah.

## A3. Siapa boleh membuka apa {#a3}

### Dashboard

| Halaman | Owner dan Pengawas | Admin and Finance | Sales | Marketing | Operasional |
|---|---|---|---|---|---|
| Overview | ya | ya | ya | ya | ya |
| Overview divisi (Sales, Marketing, Admin and Finance, Operasional) | ya | tidak | tidak | tidak | tidak |
| Daftar Penghuni | ya | ya | ya | tidak | tidak |
| Data Kamar | ya | tidak | ya | tidak | ya |
| Data Pembayaran | ya | ya | tidak | tidak | tidak |
| Daftar Vendor | ya | ya | tidak | tidak | ya |
| Daftar Tiket | ya | tidak | tidak | tidak | ya |
| Waiting List | ya | tidak | ya | tidak | tidak |
| Daftar Prospek | tidak | tidak | ya | tidak | tidak |
| Daftar Leads, Konten, Promosi | tidak | tidak | tidak | ya | tidak |
| Stok Inventory | ya | ya | tidak | tidak | ya |
| Dokumen | ya | ya | ya | ya | ya |

Pengawas melihat semua halaman seperti Owner, tapi hanya di Dashboard. Pengawas tidak punya akses Mini App dan tidak mengisi data.

Kolom data pribadi penghuni (email, kontak darurat, tanggal lahir, usia) disamarkan untuk role selain Owner, Pengawas, dan Admin and Finance.

### Mini App: form yang bisa diisi

| Role | Form |
|---|---|
| Owner | Semua |
| Admin and Finance | Penghuni Baru & Review, Pembayaran & Verifikasi, Checkout, Aktivitas Finansial, Feedback & Pengaduan, Kepuasan Penghuni, Pelanggaran Peraturan, Kecelakaan Kerja, Tugas Harian |
| Sales | Log Survey, Tambah Waiting List, Tugas Harian |
| Marketing | Log Leads Harian, Log Konten, Log Promosi, Tugas Harian |
| Operasional | Perawatan Preventif, Perbaikan Korektif, Inspeksi Kebersihan, Inspeksi Fasilitas, Input Work Order, Kamar Siap Sewa, Pemakaian Stok (Maintenance dan Cleaning), Tambah Vendor, Kecelakaan Kerja, Tugas Harian |

### Mini App: menu lain

| Menu | Siapa |
|---|---|
| Ubah Data Penghuni | Owner, Admin and Finance |
| Teman Rara: menu Pengumuman dan Akun Penghuni | Owner, Admin and Finance |
| Teman Rara: panel di dalam form (pendaftaran mandiri, pengaduan, bukti bayar, pengajuan checkout) | Owner, Admin and Finance |
| Riwayat Pembayaran | Owner, Admin and Finance, Sales |
| Laporan | Owner, Admin and Finance, Sales |
| Check-in: Daftar Booking, Approval Check-in, Penghuni Baru & Review | Owner, Admin and Finance |
| Check-in: Pre-Check In Form | Owner, Operasional |
| Check-out: Daftar Pengajuan Checkout, Approval Check-out | Owner, Admin and Finance |
| Check-out: Pre-Check Out Form | Owner, Operasional |
| Pengaturan: Kredensial WiFi, Setting Deposit, Aset Tetap & Penyusutan, Jenis Pelanggaran | Owner, Admin and Finance |
| Pengaturan: Kelola Harga Kamar, Kelola User | Owner saja |
| Setting Landing Page | Owner, Marketing |
| Inventory Stock | Owner, Admin and Finance, Operasional |

### Inventory Stock

Semua pemakai Inventory bisa melihat Dashboard, Daftar Bahan, Daftar Alat, Pembelian, dan Pemakaian. Hanya Owner yang bisa menambah atau mengubah bahan dan alat, serta membuka Koreksi Stok, Laporan Opname, dan Log Aktivitas. Di layar Inventory, Owner tertulis OWNER dan role lain tertulis STAFF.

## A4. Aturan umum semua form {#a4}

1. Kolom bertanda wajib harus diisi.
2. Tanggal biasanya terisi hari ini. Ganti kalau kejadiannya bukan hari ini.
3. Lampiran foto atau PDF maksimal 2 MB. Foto Work Order hanya JPG atau PNG.
4. Baca teks kecil di bawah kolom. Di situ ada contoh dan peringatan.
5. Setelah kirim, tunggu pesan sukses sebelum menutup halaman.
6. Isi tepat waktu, jangan dikumpulkan di akhir bulan. Laporan dan KPI membaca waktu kejadian dan waktu input.
7. Jangan membuat entri ganda untuk menimpa entri lama. Pakai Edit, Void, atau Koreksi (lihat bagian C4).

Tugas Harian berlaku untuk semua role. Isinya: tanggal, tugas, PIC, divisi, deadline, dan status (Pending, In Progress, Complete). Laporan Pekerjaan dan Laporan Kerja Operasional dibuat dari catatan ini. Kalau tugas tidak dicatat, laporan divisimu kosong.

## A5. Cara membaca Dashboard {#a5}

1. Pilih periode di bagian atas: Hari ini, Minggu ini, Bulan ini, Tahun ini, atau Custom (pilih sendiri). Bawaannya Tahun ini. Semua kartu dan grafik berubah mengikuti periode itu.
2. Baca kartu dari kiri ke kanan. Angka besar adalah capaian, tulisan kecil di bawahnya adalah target atau keterangan.
3. Batang kecil di dalam kartu adalah bar pencapaian: seberapa dekat angka dengan target. Garis kecil naik turun adalah spark: pergerakan angka dalam periode itu.
4. Tanda strip di kartu berarti belum ada data pada periode itu. Itu bukan angka nol.
5. Data lama tidak diisi tebakan. Tiket dan leads lama yang tidak punya waktu masuk atau waktu ditindak akan tampil strip sampai ada data baru.
6. Kalau angka terasa janggal, cek dulu periodenya, lalu cek apakah form terkait sudah diisi.

---

# Bagian B. Panduan per role {#bagian-b}

Tiap role punya satu bab. Satu bab cukup untuk bekerja: menu yang kamu pakai, form yang kamu isi, KPI yang menilai kamu, laporan yang berkaitan, dan rutinitas harian sampai bulanan.

## Owner {#role-owner}

Owner memantau seluruh kost dan memegang keputusan yang tidak dipegang role lain: harga kamar, akun dan role, penerima email laporan, dan koreksi stok. Owner bisa membuka semua halaman dan semua form.

### Menu yang kamu pakai

| Aplikasi | Menu |
|---|---|
| Dashboard | Overview, halaman Sales, Marketing, Admin and Finance, Operasional, serta Daftar Penghuni, Data Kamar, Data Pembayaran, Daftar Vendor, Daftar Tiket, Waiting List, Stok Inventory, Dokumen |
| Mini App | Semua form, semua menu admin, Laporan, Riwayat Pembayaran, Setting Landing Page |
| Inventory | Semua menu, termasuk yang hanya untuk Owner |

### Dashboard Owner

| Kartu atau grafik | Isi |
|---|---|
| Pendapatan Kotor, Laba Bersih, OPEX | Angka keuangan periode terpilih |
| Okupansi, Kamar Isi, Kamar Kosong | Kondisi hunian |
| Tiket Aktif | Tiket yang belum selesai |
| Total Diskon | Rupiah, dengan persen dari pendapatan di keterangan |
| RevPAR, Margin Laba Bersih, OPEX per Kamar, Kepuasan Penghuni | KPI Owner |
| Pendapatan Kotor vs Beban vs Laba Bersih | Grafik garis |
| Pemberian Diskon dan Total Beban | Grafik batang |
| Komposisi | Donut komposisi beban dan pendapatan |

### Yang hanya bisa dilakukan Owner

1. Kelola User: menyetujui akun baru, mengatur role, menonaktifkan akses. Ada di Pengaturan di Mini App.
2. Kelola Harga Kamar: tarif sewa per tipe kamar dan durasi.
3. Email Tujuan Laporan Bulanan: penerima email laporan, maksimal 10 alamat. Panel ini ada di bagian paling atas halaman Laporan dan hanya tampil untuk Owner.
4. Owner Review: laporan bulanan khusus Owner.
5. Di Inventory: tambah dan ubah bahan dan alat, Koreksi Stok, Laporan Opname, dan Log Aktivitas.

### Teman Rara untuk Owner

Teman Rara adalah aplikasi penghuni. Owner bisa membuka semua panel pengelolanya di Mini App, sama seperti Admin and Finance: pendaftaran mandiri, pengaduan, verifikasi bukti bayar, pengajuan checkout, Pengumuman dan Peraturan, Akun Penghuni, dan Kredensial WiFi. Langkah kerjanya ada di bab Admin and Finance dan di bagian C7.

Peran Owner di sini lebih ke memantau dan menjadi cadangan:

1. Di Beranda Mini App ada peringatan kuning untuk pengajuan checkout yang menunggu dan pengaduan yang belum selesai. Angkanya yang tinggi dan lama tidak turun menandakan penanganan terlambat.
2. Di Dashboard, kartu Respons Pengaduan dan Kepuasan Penghuni menunjukkan kualitas layanan ke penghuni.
3. Owner ikut bisa menyetujui, menolak, dan menerbitkan pengumuman kalau Admin and Finance berhalangan.
4. Pengumuman yang diterbitkan Owner ikut mengirim notifikasi ke HP penghuni, jadi periksa isinya sebelum klik Terbitkan.

### KPI Owner dan targetnya

| KPI | Target |
|---|---|
| Pendapatan kotor | Rp26.000.000 per bulan |
| Laba bersih | Rp15.000.000 per bulan |
| Margin laba bersih | Tanpa target, hanya informasi |
| Okupansi | 100% |
| Kamar kosong | 0 |
| RevPAR (pendapatan sewa per kamar per hari) | Tanpa target, hanya informasi |
| OPEX per kamar per bulan | Paling tinggi Rp300.000 |
| Total diskon | Paling tinggi 10% dari pendapatan |
| Tiket belum selesai | Hanya informasi |
| Kepuasan penghuni (CSAT) | Skala 1 sampai 5 |

### Laporan untuk Owner

Owner Review adalah laporan paling lengkap dan hanya Owner yang bisa membuat atau melihatnya. Isinya enam bagian: ringkasan eksekutif, hunian dan penyewa, keuangan, operasional, pencapaian KPI per divisi, serta kualitas data dan rekomendasi. Bagian KPI memuat berapa KPI tercapai dan belum per divisi, plus daftar KPI yang belum tercapai. Cara membuat dan membaca laporan ada di bagian C3.

### Rutinitas Owner

#### Harian

1. Buka Dashboard Overview. Lihat okupansi, tiket aktif, dan angka keuangan.
2. Setujui akun baru di Kelola User kalau ada yang menunggu.
3. Setujui Approval Check-in dan Check-out kalau Admin and Finance berhalangan.

#### Mingguan

1. Buka halaman Sales, Marketing, Admin and Finance, dan Operasional di Dashboard. Lihat KPI mana yang di bawah target.
2. Buka logbook semua divisi di Beranda Mini App.

#### Bulanan

1. Pastikan email penerima laporan masih benar.
2. Baca Owner Review dan daftar KPI yang belum tercapai.
3. Finalisasi Laporan Opname di Inventory.
4. Cek Log Aktivitas Inventory kalau ada selisih stok.

## Pengawas {#role-pengawas}

Pengawas hanya memakai Dashboard, dengan akses baca ke semua halaman seperti Owner. Pengawas tidak punya akses Mini App dan Inventory, dan tidak bisa mengubah data.

### Menu yang kamu pakai

Semua halaman Dashboard yang sama dengan Owner: Overview, halaman Sales, Marketing, Admin and Finance, Operasional, Daftar Penghuni, Data Kamar, Data Pembayaran, Daftar Vendor, Daftar Tiket, Waiting List, Stok Inventory, dan Dokumen. Data pribadi penghuni tampil utuh.

### Tugas utama: memeriksa data

Angka Dashboard hanya benar kalau divisi mengisi datanya. Pengawas memeriksa apakah itu terjadi. Hal yang bisa kamu perhatikan:

| Tanda | Kemungkinan artinya |
|---|---|
| Kartu menampilkan strip padahal seharusnya ada data | Form terkait belum diisi pada periode itu |
| Angka tidak bergerak berhari-hari | Divisi berhenti mengisi |
| Tiket tanpa tanggal selesai dalam waktu lama | Status tiket tidak diperbarui |
| Leads tanpa waktu chat pertama | Waktu respons tidak dicatat, jadi Respons Leads Pertama tidak terhitung |
| Dokumen Penghuni Lengkap di bawah 100% | Ada penghuni aktif yang KTP atau Surat Kontraknya belum terunggah |
| Daftar Jatuh Tempo berisi penghuni yang belum bayar | Penagihan belum jalan |

Temuan disampaikan ke divisi terkait atau Owner. Cara membaca kartu ada di bagian A5. KPI semua divisi dan targetnya ada di bab role masing-masing.

### Laporan

Pengawas tidak punya menu Laporan. Laporan bulanan sampai lewat email kalau Owner memasukkan alamat emailmu ke daftar penerima.

## Admin and Finance {#role-admin}

Admin and Finance memegang penghuni dan uang: penghuni baru, pembayaran, checkout, pengaduan, pembukuan, dan laporan keuangan. Di Dashboard, bagian Admin berpita biru dan bagian Finance berpita emas.

### Menu yang kamu pakai

| Aplikasi | Menu |
|---|---|
| Dashboard | Overview, Daftar Penghuni, Data Pembayaran, Daftar Vendor, Stok Inventory, Dokumen |
| Mini App, form | Penghuni Baru & Review, Pembayaran & Verifikasi, Checkout, Aktivitas Finansial, Feedback & Pengaduan, Kepuasan Penghuni, Pelanggaran Peraturan, Kecelakaan Kerja, Tugas Harian |
| Mini App, menu lain | Ubah Data Penghuni, Teman Rara, Riwayat Pembayaran, Laporan, Check-in dan Check-out (daftar booking, pengajuan, approval), Pengaturan |
| Inventory | Dashboard, Daftar Bahan, Daftar Alat, Pembelian, Pemakaian (lihat bagian C1) |

### Dashboard Admin and Finance

| Bagian | Kartu |
|---|---|
| Admin | Kontrak Aktif, Kamar Kosong, Jatuh Tempo (7 hari ke depan), Dokumen Penghuni Lengkap, Respons Pengaduan, Kepuasan Penghuni |
| Finance | Pendapatan, Total Diskon, Collection Rate, Margin Laba Bersih, OPEX per Kamar, Tutup Buku |
| Grafik dan tabel | Status Kontrak, Daftar Jatuh Tempo, Aging Tunggakan (donut), OPEX, Pendapatan Kotor vs Beban vs Laba Bersih |

### Penghuni Baru & Review

Form atas untuk booking langsung (walk-in atau lewat WhatsApp). Isinya: tanggal booking, nama, nomor HP, kamar (hanya kamar yang tersedia), tanggal masuk, durasi, harga disepakati, status booking, dan sumber leads. Ada juga tambahan listrik per bulan dan nama barang elektronik tambahan (misalnya kulkas), nopol dan nama kendaraan, serta unggahan dokumen identitas dan kontrak.

Panel bawah untuk meninjau pendaftaran mandiri dari aplikasi Teman Rara. Tombolnya Konfirmasi dan Tolak. Kalau menolak, isi alasan penolakan.

### Pembayaran & Verifikasi

Mencatat pembayaran sewa atau DP dan menerbitkan invoice.

1. Pilih jenis pembayaran: Sewa atau DP.
2. Untuk Sewa, pilih penghuni dan lama sewa. Periode awal sewa terisi otomatis dari tanggal habis sewa terakhir, bukan tanggal pembayaran. Ubah hanya kalau memang berbeda.
3. Untuk DP, isi nama, nomor WhatsApp, email (invoice dikirim ke sini), nomor kamar, dan tanggal masuk.
4. Isi denda, pajak, atau diskon kalau ada. Kosongkan kalau tidak ada.
5. Pilih akun kas atau bank tujuan.
6. Periksa preview. Nominal ditentukan sistem dari harga yang berlaku, bukan diketik.
7. Konfirmasi.

Panel Verifikasi Bukti Bayar di bawahnya berisi bukti transfer yang diunggah penghuni lewat Teman Rara. Setujui kalau cocok, tolak dengan alasan kalau tidak.

### Checkout

Mencatat penghuni keluar: tanggal checkout, penghuni, tanggal masuk, tunggakan (ya atau tidak, terisi otomatis dari riwayat pembayaran), kondisi kamar, dan catatan kerusakan. Pengembalian deposit mengikuti hasil Approval Check-out, bukan isian di form ini.

### Aktivitas Finansial

Mencatat pengeluaran dan pemasukan selain sewa.

Untuk pengeluaran: pilih tipe akun, akun tujuan (debit), akun sumber (kredit), nominal, keterangan, kategori (Operasional atau Non-operasional), dan divisi pengeluar. Kalau biaya dibayar di muka untuk beberapa bulan, centang Beban dimuka dan isi jumlah bulan (maksimal 240). Unggah nota kalau ada. Nomor nota dibuat otomatis dengan pola tahun-bulan, divisi, dan urutan.

Untuk pemasukan: isi nama transaksi (misalnya biaya laundry), jumlah, kas atau bank penerima, dan akun pendapatan. Catatan ini masuk ke Laba Rugi, Arus Kas, dan Dashboard.

### Feedback & Pengaduan

Form atas untuk mencatat masukan yang disampaikan lisan. Komplain masuk ke daftar keluhan penghuni, sedangkan saran dan kritik masuk ke log feedback. Panel bawah berisi pengaduan dari aplikasi Teman Rara. Isi tanggapan lalu klik Simpan Tanggapan. Tanggapan tampil di aplikasi penghuni, dan waktu tanggapan dipakai untuk menghitung Respons Pengaduan.

### Kepuasan Penghuni, Pelanggaran Peraturan, Kecelakaan Kerja

1. Kepuasan Penghuni: skor kepuasan satu penghuni untuk satu bulan (1 sampai 5) dan komentar.
2. Pelanggaran Peraturan: tanggal kejadian, penghuni, jenis pelanggaran, deskripsi, dan tindakan. Daftar jenis diatur di Pengaturan, menu Jenis Pelanggaran.
3. Kecelakaan Kerja: tanggal, lokasi, petugas, kronologi, dan tindakan.

### Check-in dan check-out

Admin and Finance memegang konfirmasi dan persetujuan di kedua alur. Langkah lengkapnya ada di bagian C2. Bagianmu: mengonfirmasi booking, menyetujui Pre-Check In, menekan tombol Check-in saat penghuni masuk, serta menyetujui Pre-Check Out dan menentukan pengembalian deposit.

### Riwayat Pembayaran

Menampilkan semua invoice per penghuni: nomor invoice, jenis, periode, status (Lunas, Belum Bayar, atau Void), invoice dalam bentuk pratinjau dan PDF. Kamu bisa melampirkan atau melepas bukti transfer, mem-void, dan mengoreksi. Void dan koreksi dijelaskan di bagian C4.

### Ubah Data Penghuni

Klik kartu penghuni untuk mengubah data: nomor HP, instansi atau kampus, kontak darurat, link identitas, tambahan listrik, nama barang tambahan, dan nopol kendaraan. Tombol Simpan Perubahan baru aktif setelah ada yang diubah.

### Teman Rara

Admin and Finance adalah penanggung jawab utama Teman Rara dari sisi pengelola. Semua kerjanya dilakukan di Mini App, tidak ada layar admin di aplikasi penghuni. Ringkasan di bawah, penjelasan lengkap dan alur datanya ada di bagian C7.

| Yang dilakukan penghuni | Kamu tangani di | Yang kamu lakukan |
|---|---|---|
| Daftar mandiri | Penghuni Baru & Review (panel bawah) | Tinjau data diri dan bukti DP, lalu Konfirmasi atau Tolak (isi alasan) |
| Kirim pengaduan | Feedback & Pengaduan (panel bawah) | Ubah status, tulis tanggapan, klik Simpan Tanggapan |
| Unggah bukti bayar | Pembayaran & Verifikasi (panel bawah) | Verifikasi, atau Tolak dengan alasan |
| Ajukan checkout | Daftar Pengajuan Checkout | Setujui atau Tolak, lalu Lanjut ke Checkout |
| Membaca pengumuman dan peraturan | Teman Rara, Pengumuman dan Peraturan | Terbitkan dan ubah |
| Memakai akun Teman Rara | Teman Rara, Akun Penghuni | Cegah akun ganda, cabut akun mantan penghuni |
| Melihat WiFi kamar | Pengaturan, Kredensial WiFi | Isi SSID dan password per kamar |

Di Beranda Mini App, Owner dan Admin and Finance melihat peringatan kuning kalau ada pengajuan checkout yang menunggu dan pengaduan yang belum selesai. Klik peringatan itu untuk langsung ke panelnya.

Target Respons Pengaduan adalah 1 jam. Waktu yang dihitung adalah dari pengaduan masuk sampai kamu menyimpan tanggapan.

### Pengaturan

| Menu | Fungsinya |
|---|---|
| Kredensial WiFi | Menyimpan nama jaringan (SSID) dan password WiFi per kamar. Penghuni membacanya di Teman Rara. |
| Setting Deposit | Menyalakan fitur deposit dan menentukan nominalnya untuk penghuni baru |
| Aset Tetap & Penyusutan | Mendaftar aset (nama, kategori, tanggal perolehan, harga). Ada tombol posting penyusutan bulanan. |
| Jenis Pelanggaran | Mengatur pilihan jenis di form Pelanggaran Peraturan |

Kelola Harga Kamar dan Kelola User hanya untuk Owner.

### KPI Admin dan Keuangan serta targetnya

| KPI | Target |
|---|---|
| Dokumen penghuni lengkap | 100% |
| Respons pengaduan | Paling lama 1 jam |
| Kamar kosong | 0 |
| Kepuasan penghuni (CSAT) | Skala 1 sampai 5, tanpa target angka |
| Pendapatan | Rp26.000.000 per bulan |
| Laba bersih | Rp15.000.000 per bulan |
| Total diskon | Paling tinggi 10% dari pendapatan |
| Collection rate | 100% |
| OPEX per kamar | Paling tinggi Rp300.000 per bulan |
| Tutup buku | 1 hari kerja setelah akhir bulan |
| Penghuni menunggak | Paling banyak 2 |

### Laporan untuk Admin and Finance

Di menu Laporan kamu bisa membuat Arus Kas, Laba Rugi, dan Neraca, serta laporan divisi: Pekerjaan Admin, Pekerjaan Keuangan, Kinerja Admin, dan Kinerja Keuangan. Kamu juga bisa membuat laporan Marketing, Sales, dan Operasional, tapi tidak Owner Review. Tutup buku dihitung dari tanggal laporan resmi pertama dibuat, jadi semakin cepat semakin baik. Detail ada di bagian C3.

### Rutinitas Admin and Finance

#### Harian

1. Catat pembayaran sewa dan DP di Pembayaran & Verifikasi. Periksa preview sebelum konfirmasi.
2. Verifikasi bukti bayar yang diunggah penghuni.
3. Tanggapi pengaduan dari Teman Rara secepatnya. Targetnya 1 jam.
4. Catat pengeluaran dan pemasukan di Aktivitas Finansial, dengan nota.
5. Tinjau pendaftaran mandiri dan booking baru di Penghuni Baru & Review.
6. Setujui pre-check in dan pre-check out di Approval.
7. Catat Tugas Harian.

#### Mingguan

1. Periksa Daftar Jatuh Tempo dan Aging Tunggakan di Dashboard, lalu hubungi penghuni yang menunggak.
2. Cek Dokumen Penghuni Lengkap. Lengkapi dokumen yang kurang.

#### Bulanan

1. Isi Kepuasan Penghuni untuk penghuni aktif.
2. Posting penyusutan bulanan di Aset Tetap & Penyusutan.
3. Selesaikan pencatatan keuangan bulan lalu, lalu buat laporan keuangan.

## Sales {#role-sales}

Sales memegang semua urusan setelah leads diserahkan Marketing: survey, booking, waiting list, dan menjaga penghuni supaya memperpanjang.

### Menu yang kamu pakai

| Aplikasi | Menu |
|---|---|
| Dashboard | Overview, Daftar Prospek, Daftar Penghuni, Data Kamar, Waiting List, Dokumen |
| Mini App, form | Log Survey, Tambah Waiting List, Tugas Harian |
| Mini App, menu lain | Riwayat Pembayaran (hanya melihat), Laporan |
| Inventory | Tidak dipakai Sales |

### Dashboard Sales

| Bagian | Isi |
|---|---|
| Baris pertama | Survey, Konversi Leads → Survey, Booking, Konversi Survey → Booking, Cancellation Rate |
| Baris kedua | Respons Leads Pertama, Renewal Rate, Rata-Rata Lama Sewa, Vacancy Days, Waiting List, Okupansi |
| Grafik dan tabel | Tren Booking & Survey, Funnel Penjualan, Kategori Prospek, Daftar Prospek |

Daftar Prospek berisi leads yang belum survey ditambah yang sudah survey tapi belum booking. Satu orang satu baris (dicocokkan lewat nomor HP). Booking yang batal kembali menjadi prospek.

### Log Survey

Mencatat tiap kunjungan survey: tanggal dan jam, nama dan nomor HP calon penyewa, asal informasi, kamar yang ditinjau (pisahkan dengan koma), durasi, kesan, keberatan, hasil survey, tindak lanjut, PIC, dan tanggal follow-up.

### Tambah Waiting List

Mencatat calon penghuni yang menunggu kamar: nama, WhatsApp, tipe kamar, rencana masuk, budget maksimal, dan status (Menunggu, Dihubungi, Closed).

### Booking dicatat Admin and Finance

Sales tidak punya form booking. Booking dicatat Admin and Finance di Penghuni Baru & Review. Koordinasikan supaya booking dari survey cepat dicatat, karena angka Booking dan Konversi Survey → Booking bergantung padanya.

### Teman Rara untuk Sales

Teman Rara adalah aplikasi untuk penghuni. Sales tidak punya menu Teman Rara dan tidak bisa membuka panelnya (pendaftaran mandiri, pengaduan, bukti bayar, pengajuan checkout, akun, pengumuman). Semua itu ditangani Admin and Finance. Meski begitu, ada empat hal dari Teman Rara yang memengaruhi pekerjaan Sales.

1. Pendaftaran mandiri masuk sebagai booking. Calon penghuni yang mengisi form di Teman Rara tercatat sebagai booking berstatus Pending, lalu ditinjau Admin and Finance. Sistem menghitung booking yang tidak berstatus batal sebagai Booking di Dashboard Sales. Kalau pendaftaran ditolak, statusnya menjadi Dibatalkan dan ikut naik di Cancellation Rate. Kalau ada calon penghuni yang kamu survey lalu mendaftar sendiri di Teman Rara, kabari Admin and Finance supaya cepat ditinjau.
2. Riwayat Pembayaran. Di menu ini kamu melihat invoice penghuni beserta statusnya (Lunas, Belum Bayar, Void) dan bukti transfer yang tertaut ke invoice, termasuk yang diunggah penghuni lewat Teman Rara. Kamu hanya melihat. Verifikasi bukti, void, dan koreksi dilakukan Owner atau Admin and Finance.
3. Pengingat jatuh tempo. Teman Rara menampilkan tagihan dan pengingat jatuh tempo ke penghuni. Invoice yang di-void tidak dihitung sebagai tagihan, tunggakan, atau pengingat. Ini membantu kamu menindaklanjuti perpanjangan sewa (Renewal Rate), tapi pengingatnya berjalan otomatis, bukan dari kamu.
4. Data diri penghuni. Data yang diisi penghuni di Teman Rara (instansi, kontak darurat, identitas, nopol) disalin ke data penghuni saat check-in. Di Dashboard, kamu melihat Daftar Penghuni tanpa kolom data pribadi.

Kalau penghuni bertanya soal pengaduan, bukti bayar, atau akun Teman Rara, arahkan ke Admin and Finance.

### KPI Sales dan targetnya

| KPI | Target |
|---|---|
| Booking baru | Minimal 1 per bulan |
| Konversi Leads → Survey | 90% |
| Konversi Survey → Booking | 90% |
| Cancellation rate | Paling tinggi 20% |
| Respons leads pertama | Paling lama 15 menit |
| Renewal rate | 100% |
| Rata-rata lama sewa | Minimal 3 bulan |
| Vacancy days | Paling lama 30 hari |
| Waiting list | Antrean sekitar 5 orang |
| Okupansi | 100% |

### Laporan untuk Sales

Di menu Laporan kamu bisa membuat Arus Kas, Laba Rugi, Neraca, dan laporan divisi. Laporan milikmu adalah Pekerjaan Sales dan Kinerja Sales. Owner Review tidak tersedia untukmu. Detail ada di bagian C3.

### Rutinitas Sales

#### Harian

1. Catat setiap survey di Log Survey, lengkap dengan hasil dan tanggal follow-up.
2. Tambahkan calon penghuni ke Waiting List kalau tidak ada kamar kosong.
3. Hubungi leads yang baru masuk secepatnya. Targetnya 15 menit sejak leads masuk.
4. Catat Tugas Harian.

#### Mingguan

1. Buka Daftar Prospek di Dashboard dan follow-up yang belum survey atau belum booking.
2. Lihat Funnel Penjualan.

#### Bulanan

1. Ingatkan penghuni yang sewanya akan jatuh tempo supaya memperpanjang. Itu yang menaikkan Renewal Rate.
2. Baca Kinerja Sales.

## Marketing {#role-marketing}

Marketing menciptakan leads dengan biaya terkendali. Tugas Marketing berhenti di leads: survey dan seterusnya dihitung di Sales.

### Menu yang kamu pakai

| Aplikasi | Menu |
|---|---|
| Dashboard | Overview, Daftar Leads, Konten, Promosi, Dokumen |
| Mini App, form | Log Leads Harian, Log Konten, Log Promosi, Tugas Harian |
| Mini App, menu lain | Setting Landing Page |
| Inventory | Tidak dipakai Marketing |

### Dashboard Marketing

| Bagian | Isi |
|---|---|
| Baris pertama | Leads Masuk, Pencapaian Target Leads, CPL, CAC |
| Baris kedua | ROI Promosi, Engagement Rate, Konsistensi Posting |
| Grafik dan tabel | Tren Leads, Funnel Konten (View, Action, Leads), Leads Channel, Daftar Follow Up |

### Log Leads Harian

Isi waktu lead benar-benar masuk, bukan waktu kamu mencatat. Kolom Waktu Chat Pertama Dikirim boleh dikosongkan dulu dan diisi lewat Edit setelah chat terkirim. Dua waktu ini yang dipakai menghitung Respons Leads Pertama. Status leads: Baru, Follow-up, Survey, Negosiasi, Booking, Tidak Jadi, Tidak Respons.

### Log Konten

Mencatat tiap konten: tanggal, platform, tipe, judul atau caption, link, jam tayang, dan status. Like, komentar, share, dan reach boleh diisi belakangan setelah konten tayang. Isi biaya produksi (fotografer, editor, properti) karena dipakai menghitung CAC.

### Log Promosi

Mencatat promosi atau iklan: nama, platform, tanggal mulai dan selesai, budget, target leads, spend aktual, leads aktual, booking dari promo, dan status. Spend, leads, dan booking diisi belakangan seiring promo berjalan. Angka ini yang membentuk CPL, ROI, dan Pencapaian Target Leads.

### Setting Landing Page

Klik tautannya dan admin landing page terbuka di tab baru, langsung masuk tanpa mengetik password. Tiket masuknya berlaku 60 detik, jadi klik tautannya hanya saat kamu mau masuk. Kalau membuka alamat `/admin` landing page secara langsung, password admin tetap diminta.

### KPI Marketing dan targetnya

| KPI | Target |
|---|---|
| Leads masuk | Minimal 10 per minggu |
| Pencapaian target leads | 80% |
| CPL | Paling tinggi Rp25.000 |
| CAC | Paling tinggi Rp50.000 |
| ROI promosi | 100% |
| Engagement rate | 70% |
| Konsistensi posting | 100% |

### Laporan untuk Marketing

Marketing tidak punya menu Laporan. Laporan Pekerjaan Marketing dan Kinerja Marketing dibuat oleh Owner, Admin and Finance, atau Sales, dan sampai ke Marketing lewat email bulanan. Bagian Kinerja Marketing berisi indikator kinerja, akuisisi leads, kinerja konten, dan kinerja promosi. Detail ada di bagian C3.

### Rutinitas Marketing

#### Harian

1. Catat setiap leads baru di Log Leads Harian, dengan waktu masuk yang sebenarnya.
2. Isi Waktu Chat Pertama Dikirim lewat Edit setelah leads dibalas.
3. Catat konten yang tayang di Log Konten.
4. Catat Tugas Harian.

#### Mingguan

1. Perbarui like, komentar, share, dan reach di konten yang sudah tayang.
2. Perbarui spend, leads aktual, dan booking dari promo di Log Promosi.

#### Bulanan

1. Pastikan biaya produksi konten sudah terisi. CAC bergantung padanya.
2. Baca Kinerja Marketing.

## Operasional {#role-operasional}

Operasional menjaga kamar dan fasilitas layak huni: perawatan, perbaikan, inspeksi, kebersihan, vendor, dan kesiapan kamar. Satu role mencakup Maintenance, Inspeksi, dan Cleaning.

**Status kamar.** Kosong dan Terisi berubah otomatis (check-in dan checkout). Status **Maintenance** dipasang oleh salah satu dari empat pemicu, dan kamar baru kembali setelah semua pemicunya selesai (Terisi bila ada penghuni aktif, selain itu Kosong):

| Pemicu | Memasang Maintenance | Melepas |
|---|---|---|
| Tombol di menu **Status Kamar** | Tandai Maintenance (alasan wajib) | Selesai Maintenance (menutup semua pemicu kamar itu) |
| Pengaduan Teman Rara | Komplain kategori Listrik, Air, AC, atau Fasilitas diubah ke Diproses | Selesai, Dibatalkan, atau kembali ke Menunggu |
| Inspeksi checkout (Pre-Check Out Form) | Ada item Rusak atau Perlu Perbaikan | Kamar Siap Sewa diisi, atau inspeksi dikirim ulang semua Baik |
| Work order tujuan Maintenance | Kolom Kamar diisi di form work order | Work order Complete |

Kamar Maintenance tidak muncul di pilihan booking baru, dan checkout tidak mengubahnya menjadi Kosong selama masih ada pemicu terbuka.

### Menu yang kamu pakai

| Aplikasi | Menu |
|---|---|
| Dashboard | Overview, Daftar Tiket, Daftar Vendor, Stok Inventory, Data Kamar, Dokumen |
| Mini App, form | Perawatan Preventif, Perbaikan Korektif, Inspeksi Kebersihan, Inspeksi Fasilitas, Input Work Order, Kamar Siap Sewa, Pemakaian Stok (Maintenance dan Cleaning), Tambah Vendor, Kecelakaan Kerja, Tugas Harian |
| Mini App, menu lain | Pre-Check In Form dan Pre-Check Out Form |
| Inventory | Dashboard, Daftar Bahan, Daftar Alat, Pembelian, Pemakaian (lihat bagian C1) |

### Beranda dan Joblist

Beranda Mini App berisi kartu menu sesuai role-mu, dan di bawahnya Joblist: work order untuk divisimu (Maintenance, Inspeksi, Cleaning). Kalau ada work order berstatus Pending, muncul peringatan kuning. Untuk menandai pekerjaan selesai, ubah statusnya. Pekerjaan yang selesai hilang dari tabel Joblist.

### Dashboard Operasional

| Bagian | Isi |
|---|---|
| Kartu atas | Tiket Preventif, Tiket Korektif, Defect Rate, Total Tiket, Biaya Perbaikan |
| Kartu KPI | Kepatuhan SLA Tiket, Resolution Time, Kepatuhan Jadwal Preventif, Kepatuhan Inspeksi Harian, Waktu Prepare Kamar, Tiket Berulang, Biaya Perbaikan per Kamar |
| Grafik dan tabel | Expense Category, Tren Tiket Maintenance, Status Tiket |

### Perawatan Preventif dan Perbaikan Korektif

Keduanya mirip: tanggal, fasilitas atau lokasi, kategori, penyebab (Wear and Tear atau Human Eror), deskripsi, prioritas, pelaksana, vendor, biaya, status, dan lampiran. Status yang tersedia: Selesai, Proses, Tertunda, Menunggu Vendor.

Khusus Korektif ada dua waktu: Waktu Laporan Masuk dan Waktu Mulai Ditindak. Waktu mulai ditindak terisi otomatis saat status diubah ke Proses. Isi tanggal selesai begitu pekerjaan tuntas, karena tiket tanpa tanggal selesai dianggap belum selesai dan tidak masuk hitungan Resolution Time.

### Inspeksi Kebersihan dan Inspeksi Fasilitas

Mencatat area, kondisi yang ditemukan, tindak lanjut, petugas, dan foto. Satu inspeksi per hari sudah cukup untuk membuat hari itu dihitung patuh.

### Input Work Order

Dipakai saat menemukan masalah yang harus dikerjakan divisi lain. Isi lokasi atau item, kategori, deskripsi, prioritas (Rendah, Sedang, Tinggi, Darurat), divisi tujuan, target deadline, dan foto bukti. Work order muncul di Joblist divisi tujuan.

### Pre-Check In dan Pre-Check Out

Form pemeriksaan kondisi kamar sebelum penghuni masuk atau keluar. Isi tanggal cek dan catatan kondisi. Setelah diajukan, form tidak bisa diubah. Hasilnya menunggu persetujuan Admin and Finance atau Owner. Urutan lengkapnya ada di bagian C2.

### Kamar Siap Sewa

Setelah kamar bekas checkout selesai dibersihkan dan diperbaiki, pilih kamar itu dan isi Waktu Kamar Siap. Waktu ini dipakai menghitung Waktu Prepare Kamar. Yang muncul di pilihan hanya checkout yang belum ditandai siap.

### Pemakaian Stok dan Tambah Vendor

1. Pemakaian Stok (Maintenance atau Cleaning): pilih bahan, isi jumlah dipakai, dan catatan lokasi atau keperluan. Daftar bahan dan sisa stok diambil langsung dari Inventory Stock, jadi pemakaian di sini ikut mengurangi stok di sana. Jangan mencatat pemakaian yang sama lagi di Inventory.
2. Tambah Vendor: nama vendor, kategori, nomor telepon, dan catatan penilaian.
3. Kecelakaan Kerja: tanggal, lokasi, petugas, kronologi, dan tindakan.

### KPI Operasional dan targetnya

| KPI | Target |
|---|---|
| Kepatuhan SLA tiket | 100% (SLA saat ini 3 hari) |
| Resolution time | Paling lama 1 hari |
| Kepatuhan jadwal preventif | 100% |
| Kepatuhan inspeksi harian | 100% |
| Waktu prepare kamar | Paling lama 1 hari |
| Tiket berulang | Paling banyak 2 kasus |
| Biaya perbaikan per kamar | Paling tinggi Rp150.000 |

### Laporan untuk Operasional

Operasional tidak punya menu Laporan. Laporan Kerja Operasional dan Kinerja Operasional dibuat oleh Owner, Admin and Finance, atau Sales, dan sampai ke Operasional lewat email bulanan. Laporan Kerja Operasional berisi ringkasan per sub-divisi (Maintenance, Inspeksi, Cleaning) dan rincian tugas. Kinerja Operasional berisi indikator kinerja, inspeksi harian, perawatan preventif, perbaikan korektif, dan total pengeluaran operasional. Detail ada di bagian C3.

### Rutinitas Operasional

#### Harian

1. Isi Inspeksi Kebersihan atau Inspeksi Fasilitas. Minimal satu per hari supaya Kepatuhan Inspeksi tidak turun.
2. Periksa Joblist di Beranda dan kerjakan work order berstatus Pending.
3. Update tiket: ubah status ke Proses saat mulai, isi tanggal selesai saat tuntas.
4. Isi Pre-Check In dan Pre-Check Out kalau ada penghuni masuk atau keluar.
5. Isi Kamar Siap Sewa begitu kamar bekas checkout siap.
6. Catat pemakaian stok.
7. Catat Tugas Harian.

#### Mingguan

1. Periksa jadwal preventif yang sudah lewat tapi belum selesai.
2. Periksa Tiket Berulang di Dashboard. Kasus yang berulang biasanya perlu perbaikan permanen, bukan tambal sulam.
3. Lihat daftar stok menipis dan sampaikan ke Admin and Finance untuk belanja.

#### Bulanan

1. Baca Kinerja Operasional.
2. Bantu hitung fisik stok saat opname.

---

# Bagian C. Referensi bersama {#bagian-c}

Bagian ini dipakai lintas role. Bab role di Bagian B menunjuk ke sini kalau perlu detail.

## C1. Inventory Stock {#c1}

Dipakai Owner, Admin and Finance, dan Operasional. Inventory mencatat dua hal: bahan habis pakai (sabun, pembersih, lampu, dan sebagainya) dan alat.

### Menu

| Menu | Fungsinya | Siapa |
|---|---|---|
| Dashboard | Jumlah bahan, bahan stok menipis, dan jumlah mutasi stok terbaru | Semua |
| Daftar Bahan | Daftar bahan, stok terkini, dan batas minimum. Cari berdasarkan nama atau kategori. | Semua lihat, Owner tambah dan ubah |
| Daftar Alat | Daftar alat, jumlah, dan kondisi | Semua lihat, Owner tambah dan ubah |
| Pembelian | Mencatat belanja bahan | Semua |
| Pemakaian | Mencatat bahan yang dipakai | Semua |
| Koreksi Stok | Menyesuaikan stok kalau ada selisih (pecah, susut) | Owner |
| Laporan Opname | Hitung fisik akhir bulan | Owner |
| Log Aktivitas | Riwayat siapa mengubah apa | Owner |

### Mencatat pembelian

1. Buka Pembelian.
2. Pilih bahan, isi jumlah belanja, tanggal pembelian, dan harga total belanja.
3. Harga per satuan terhitung sendiri di layar.
4. Isi catatan kalau perlu, misalnya tempat belanja, lalu simpan.

Setiap pembelian menjadi satu batch dan menambah stok.

### Mencatat pemakaian

1. Buka Pemakaian.
2. Pilih bahan dan, kalau ada, batch asal bahan itu. Pilihan Tanpa batch dipakai untuk stok lama yang tidak punya data harga. Pemakaian tanpa batch dicatat tanpa biaya.
3. Isi jumlah. Biaya pemakaian muncul otomatis untuk pemakaian dari batch.
4. Isi catatan lokasi, misalnya kamar yang dibersihkan, lalu simpan.

Memakai bahan lewat form Pemakaian Stok di Mini App hasilnya sama. Pilih salah satu cara, jangan catat dua kali.

### Stok menipis

Bahan dianggap menipis kalau stok terkini sama dengan atau di bawah batas minimum. Daftarnya tampil di Dashboard Inventory dan di halaman Stok Inventory di Dashboard utama.

### Opname akhir bulan (Owner)

1. Buat laporan opname untuk satu periode. Sistem mengisi Stok Sistem.
2. Isi Stok Fisik hasil hitungan di gudang. Selisih terhitung otomatis. Tambahkan keterangan kalau ada selisih.
3. Klik Simpan Draf untuk menyimpan sementara. Statusnya DRAFT.
4. Setelah semua benar, finalisasi. Statusnya berubah menjadi FINALIZED dan tidak bisa diubah lagi.
5. Klik Cetak PDF kalau perlu salinan. Di bagian tanda tangan ada nama staf penanggung jawab dan Owner verifikator.

## C2. Alur check-in dan check-out {#c2}

Dua alur ini melibatkan beberapa role. Tabel di bawah menunjukkan siapa mengerjakan apa.

### Check-in penghuni baru

| Langkah | Dikerjakan | Di mana |
|---|---|---|
| 1. Booking dicatat | Admin and Finance (atau masuk dari Teman Rara) | Penghuni Baru & Review |
| 2. Booking dikonfirmasi | Admin and Finance | Review Pendaftaran, tombol Konfirmasi |
| 3. Kondisi kamar diperiksa | Operasional | Pre-Check In Form |
| 4. Hasil pemeriksaan disetujui | Admin and Finance atau Owner | Approval Check-in |
| 5. Penghuni masuk | Admin and Finance | Daftar Booking, tombol Check-in |

Tombol Check-in baru aktif setelah dua syarat terpenuhi: booking sudah dikonfirmasi dan inspeksi sudah disetujui. Kalau tombolnya abu-abu, arahkan kursor ke tombol. Alasannya tertulis di sana.

### Check-out

| Langkah | Dikerjakan | Di mana |
|---|---|---|
| 1. Checkout dicatat | Pengajuan penghuni muncul di Daftar Pengajuan Checkout. Admin and Finance juga bisa mencatat langsung. | Daftar Pengajuan Checkout atau form Checkout |
| 2. Kondisi kamar diperiksa | Operasional | Pre-Check Out Form |
| 3. Hasil disetujui dan deposit ditentukan | Admin and Finance atau Owner | Approval Check-out |
| 4. Kamar ditandai siap | Operasional | Kamar Siap Sewa |

## C3. Laporan {#c3}

### Dua jenis laporan

1. Laporan keuangan PSAK: Arus Kas, Laba Rugi, Neraca, dan versi Lengkap yang menggabungkan ketiganya.
2. Laporan bulanan divisi: 11 laporan yang dijelaskan di bawah.

Semua dibuat dari database. Jadi isinya hanya sebagus data yang kamu input.

### Daftar 11 laporan bulanan divisi

| Kelompok | Laporan | Isinya |
|---|---|---|
| Kerja divisi | Pekerjaan Admin, Keuangan, Marketing, Sales | Ringkasan (total, selesai, proses, tertunda, persentase selesai), rincian tugas, dan kolom catatan kendala. Ada tempat tanda tangan pembuat dan pengelola. |
| Kerja divisi | Kerja Operasional | Ringkasan per sub-divisi (Maintenance, Inspeksi, Cleaning): total task, complete, in progress, pending, dan lewat deadline, lalu rincian tiap sub-divisi |
| Kinerja divisi | Kinerja Admin | Indikator kinerja, penanganan feedback, pelanggaran peraturan, logbook kecelakaan kerja |
| Kinerja divisi | Kinerja Keuangan | Indikator kinerja, arus kas, pengeluaran per kategori, rincian transaksi |
| Kinerja divisi | Kinerja Sales | Indikator kinerja dan aktivitas booking |
| Kinerja divisi | Kinerja Marketing | Indikator kinerja, akuisisi leads, kinerja konten, kinerja promosi |
| Kinerja divisi | Kinerja Operasional | Indikator kinerja, inspeksi harian, perawatan preventif, perbaikan korektif, total pengeluaran operasional |
| Owner | Owner Review | Ringkasan eksekutif, hunian dan penyewa, keuangan, operasional, pencapaian KPI per divisi, kualitas data dan rekomendasi |

Laporan Kerja adalah daftar apa yang dikerjakan. Laporan Kinerja adalah penilaian apakah target tercapai. Owner Review hanya bisa dilihat dan dibuat Owner.

### Membuat atau mengunduh laporan manual

Menu Laporan ada di Mini App untuk Owner, Admin and Finance, dan Sales.

1. Untuk laporan keuangan, pilih periode lalu klik Generate Arus Kas, Generate Laba Rugi, atau Generate Neraca.
2. Untuk laporan divisi, pilih Periode di bagian Laporan Bulanan Divisi. Setiap laporan punya tiga tombol:
   Pratinjau untuk melihat di layar. Unduh PDF untuk menyimpan file. Generate & Arsipkan untuk membuat laporan resmi, mencatatnya di riwayat, dan menyimpannya di Google Drive.
3. Riwayat Laporan Bulanan di bagian bawah memuat laporan yang pernah dibuat, beserta tautan Buka di Drive.

Bulan berjalan belum selesai, jadi hanya Pratinjau dan Unduh PDF yang bisa dipakai. Generate & Arsipkan baru bisa setelah bulan berakhir.

Marketing, Operasional, dan Pengawas tidak punya menu Laporan. Mereka menerima laporan lewat email bulanan.

### Pembuatan otomatis dan email bulanan

Pada tanggal 1, 2, dan 3 tiap bulan pukul 08.00 WIB, sistem membuat semua laporan bulan sebelumnya. Tanggal 2 dan 3 hanya mengulang yang belum berhasil. Laporan yang sudah ada tidak dibuat dua kali.

Setelah semuanya ada, sistem mengirim satu email berisi PDF 14 laporan: Owner Review, tiga laporan keuangan, lima laporan kerja divisi, dan lima laporan kinerja divisi. Versi Lengkap hanya disimpan di Drive. Kalau lampiran terlalu besar, email dipecah jadi beberapa bagian.

Owner mengatur penerima email di panel Email Tujuan Laporan Bulanan (maksimal 10 alamat, boleh menempel beberapa sekaligus). Kalau ada laporan yang gagal dibuat, email ditunda sampai semuanya berhasil.

### Membaca scorecard KPI

Laporan Kinerja dan Owner Review diawali bagian Indikator Kinerja berbentuk tabel dengan empat kolom: nama KPI, capaian, target, dan status.

| Status | Artinya |
|---|---|
| Tercapai | Capaian memenuhi target |
| Belum tercapai | Capaian belum memenuhi target |
| Strip pendek di kolom status | KPI itu memang tidak punya target, hanya informasi |
| Strip panjang di kolom capaian | Belum ada data pada periode itu |

Tanda ≥ di kolom target berarti capaian harus sama dengan atau lebih tinggi. Tanda ≤ berarti capaian harus sama dengan atau lebih rendah.

Beberapa hal yang perlu diketahui:

1. Angkanya dihitung dengan rumus yang sama dengan kartu Dashboard. Kalau beda, selisihnya biasanya karena periodenya berbeda.
2. Tanggal acuan untuk jatuh tempo, tunggakan, okupansi, dan lama sewa adalah akhir periode. Jadi laporan Oktober tidak berubah karena kejadian di November.
3. Pendapatan, margin, dan persen diskon memakai pendapatan kotor, sama dengan Dashboard.
4. Laporan yang sudah diarsipkan tidak ikut berubah kalau kemudian ada void atau koreksi. Hanya laporan yang dibuat ulang yang memakai data terbaru.
5. Bagian Kualitas Data & Rekomendasi di Owner Review muncul kalau ada data yang kosong, misalnya belum ada inspeksi, belum ada transaksi di jurnal, atau belum ada rekap leads.

Target mengacu pada SOW divisi. Kalau SOW berubah, target diubah di kode, bukan di layar. Daftar target per divisi ada di bab role masing-masing.

## C4. Memperbaiki salah input {#c4}

Prinsipnya: jangan menghapus catatan keuangan. Sistem menyimpan catatan lama sebagai riwayat supaya bisa diaudit.

| Yang salah | Cara memperbaiki |
|---|---|
| Form biasa (survey, leads, konten, promosi, tiket, inspeksi, dan sejenisnya) | Cari entri di panel daftar di bawah form, klik Edit, ubah, simpan. Data lama ditimpa. |
| Pembayaran sewa atau DP | Buka Riwayat Pembayaran. Pilih Koreksi untuk membuat invoice pengganti, atau Void kalau pembayaran memang batal. |
| Entri Aktivitas Finansial | Pilih entri di panel yang tersedia lalu Simpan sebagai koreksi, atau pilih Void tanpa pengganti kalau salah catat atau dibatalkan. |
| Stok Inventory | Owner memakai Koreksi Stok, dengan alasan yang jelas. |
| Bukti transfer salah tautan | Di Riwayat Pembayaran, lepas bukti dari invoice. Berkas di Drive tidak dihapus. |

Akibat void dan koreksi pembayaran:

1. Void: invoice ditandai Void dan jurnalnya dibalik. Penghuni menerima email berisi salinan invoice bercap DIBATALKAN dan alasannya. Invoice yang di-void tidak dihitung sebagai tagihan, tunggakan, atau pengingat jatuh tempo.
2. Koreksi: invoice lama di-void dan invoice baru bernomor akhiran -K dikirim ke penghuni sebagai REVISI.
3. Hanya Owner dan Admin and Finance yang bisa void dan koreksi. Alasan wajib diisi.
4. Laporan yang sudah dibuat tidak berubah.

Kalau sebuah form tidak punya tombol Edit, hubungi Owner atau Admin and Finance. Jangan membuat entri ganda untuk menimpa yang lama.

## C5. Masalah yang sering muncul {#c5}

| Masalah | Penyebab dan jalan keluar |
|---|---|
| Layar Menunggu Persetujuan | Akunmu belum disetujui. Hubungi Owner. |
| Menu yang kamu butuhkan tidak ada | Menu mengikuti role. Cek bagian A3. Kalau seharusnya ada, minta Owner memeriksa role-mu. |
| Bisa masuk Mini App tapi Dashboard menolak | Akses Dashboard diatur terpisah. Minta Owner membukanya. |
| Halaman menolak dengan tulisan Tidak punya akses | Role-mu memang tidak boleh membukanya. |
| Kode 2FA ditolak | Cek jam di HP sudah otomatis. Kode berganti tiap beberapa detik, jadi masukkan kode yang paling baru. |
| Angka Dashboard tidak berubah setelah input | Tekan tombol muat ulang. Cek juga periode yang dipilih. |
| Kartu menampilkan strip | Belum ada data di periode itu, atau datanya belum lengkap. Strip bukan nol. |
| Tombol Check-in abu-abu | Booking belum dikonfirmasi, atau inspeksi belum disetujui. Arahkan kursor ke tombol untuk melihat alasannya. |
| Kamar tidak muncul di form Penghuni Baru | Form hanya menampilkan kamar yang tersedia. |
| Periode Awal Sewa terisi tanggal yang tidak kamu duga | Itu tanggal habis sewa terakhir di database. Ubah manual hanya kalau memang berbeda. |
| Tidak bisa Generate & Arsipkan | Bulannya belum berakhir. Pakai Pratinjau atau Unduh PDF dulu. |
| Laporan tidak punya tautan Drive | Folder Drive laporan itu belum diatur atau unggahan gagal. Laporan tetap tercatat. Minta Owner memeriksa folder. Kamu tetap bisa Unduh PDF. |
| Email laporan bulanan belum datang | Alamat tujuan kosong, atau ada laporan yang gagal dibuat. Sistem mencoba lagi di tanggal 2 dan 3. |
| Setting Landing Page malah meminta password | Tiket masuk berlaku 60 detik atau kamu membuka alamat admin langsung. Buka lewat tautan di Mini App atau Dashboard. |
| Gagal unggah lampiran | Ukuran lebih dari 2 MB, atau formatnya tidak didukung. Kecilkan foto lalu coba lagi. |
| Stok di Inventory tidak sama dengan hitungan fisik | Lakukan Opname. Owner menyesuaikan selisih lewat Koreksi Stok. |

## C6. Hal yang belum ada atau perlu diketahui {#c6}

1. Menu Pencatatan Pendapatan dan Pencatatan Pengeluaran belum aktif. Gunakan Aktivitas Finansial untuk keduanya.
2. Form Pindah Kamar sudah dihapus dari aplikasi ini.
3. Data lama tidak dilengkapi dengan tebakan. Tiket dan leads lama yang tidak punya waktu masuk dan waktu ditindak akan tampil strip.
4. Nominal tunggakan adalah perkiraan, dihitung dari satu tagihan bulanan terakhir per penghuni yang menunggak.
5. Kepatuhan inspeksi dihitung dari jumlah hari yang punya inspeksi, karena jadwal inspeksi tidak disimpan di data.
6. Target angka bisa berubah. Kalau SOW direvisi, target di laporan diubah di kode, jadi minta pengelola sistem.

## C7. Teman Rara {#c7}

Teman Rara adalah aplikasi untuk penghuni. Penghuni memakainya untuk daftar mandiri, mengunggah bukti bayar, mengirim pengaduan, mengajukan checkout, membaca pengumuman dan peraturan, serta melihat WiFi kamarnya.

Teman Rara dan Mini App memakai satu database yang sama. Tidak ada tombol sinkron: begitu penghuni mengirim sesuatu, data itu langsung muncul di panel Mini App, dan sebaliknya tanggapan dari pengelola langsung tampil di aplikasi penghuni. Pengelola tidak punya layar admin di Teman Rara. Semua dikerjakan dari Mini App.

Panduan ini hanya menjelaskan sisi pengelola. Tampilan di sisi penghuni berasal dari aplikasi Teman Rara yang terpisah.

### Siapa menangani apa

| Fitur Teman Rara | Dikerjakan di Mini App | Owner | Admin and Finance | Sales |
|---|---|---|---|---|
| Pendaftaran mandiri | Penghuni Baru & Review | ya | ya | tidak |
| Pengaduan | Feedback & Pengaduan | ya | ya | tidak |
| Bukti bayar | Pembayaran & Verifikasi | ya | ya | tidak |
| Invoice dan bukti transfer | Riwayat Pembayaran | ya | ya | hanya melihat |
| Pengajuan checkout | Daftar Pengajuan Checkout | ya | ya | tidak |
| Pengumuman dan peraturan | Teman Rara, Pengumuman | ya | ya | tidak |
| Akun penghuni | Teman Rara, Akun Penghuni | ya | ya | tidak |
| WiFi kamar | Pengaturan, Kredensial WiFi | ya | ya | tidak |

Marketing dan Operasional tidak punya akses ke panel Teman Rara. Pengawas hanya memakai Dashboard.

### Pendaftaran mandiri

Penghuni baru bisa mengisi data diri sendiri di Teman Rara. Hasilnya muncul di panel bawah halaman Penghuni Baru & Review.

1. Secara bawaan panel hanya menampilkan pendaftaran yang berstatus Pending. Ada pilihan untuk melihat semua (50 terbaru).
2. Tiap pendaftaran menampilkan data diri lengkap: nama, asal daerah, nomor HP, kamar, rencana masuk, pekerjaan, program studi atau instansi, dua kontak darurat, jumlah gadget dan barang elektronik, kendaraan, scan identitas, dan bukti DP, ditambah harga dan durasi yang disepakati.
3. Kalau penghuni membawa barang elektronik, isi Tambahan Listrik per bulan dan Nama Barang Tambahan di panel ini.
4. Klik Konfirmasi kalau datanya benar. Klik Tolak kalau tidak, dan isi alasan penolakan. Status booking menjadi Konfirmasi atau Dibatalkan.
5. Konfirmasi belum membuat penghuni. Penghuni baru terbentuk saat kamu klik Check-in di Daftar Booking, setelah inspeksi kamar disetujui (alurnya di bagian C2).
6. Saat check-in, data diri dari Teman Rara disalin ke data penghuni: instansi, kontak darurat, link identitas, dan kendaraan. Yang disalin hanya kolom yang masih kosong, jadi koreksi manual yang sudah kamu buat tidak tertimpa.
7. Kalau nopol tidak dikenali formatnya atau sudah terdaftar atas penghuni lain, muncul peringatan dan nopol tidak disalin. Isi manual lewat Ubah Data Penghuni.

### Pengaduan

Pengaduan dari penghuni tampil di panel bawah Feedback & Pengaduan.

1. Panel menampilkan pengaduan yang belum selesai. Kalau kosong, tertulis tidak ada pengaduan yang perlu ditindak.
2. Status yang tersedia: Menunggu, Diproses, Selesai, Dibatalkan. Ubah status sesuai progres supaya penghuni melihat perkembangannya.
3. Tulis tanggapan lalu klik Simpan Tanggapan. Tanggapan itu tampil di aplikasi Teman Rara milik penghuni.
4. Waktu kamu menyimpan tanggapan dipakai menghitung KPI Respons Pengaduan. Targetnya paling lama 1 jam.
5. Jumlah pengaduan yang belum selesai juga tampil sebagai peringatan kuning di Beranda untuk Owner dan Admin and Finance.

### Bukti bayar

Penghuni bisa mengunggah bukti transfer untuk invoice. Antreannya ada di panel Verifikasi Bukti Bayar, di bawah form Pembayaran & Verifikasi.

1. Antrean berisi bukti yang belum diverifikasi dan belum ditolak. Tiap bukti menampilkan invoice terkait dan nominalnya.
2. Klik Verifikasi kalau bukti cocok. Klik Tolak kalau tidak, dan isi alasan penolakan (minimal 5 karakter, maksimal 500).
3. Satu bukti hanya punya satu keputusan. Kalau salah menekan, pakai aksi batal untuk mengembalikan bukti ke antrean, lalu putuskan ulang.
4. Verifikasi hanya menandai bukti sebagai sah. Pembayarannya sendiri tetap dicatat lewat form di bagian atas halaman yang sama.
5. Invoice yang sudah di-void tidak bisa diunggah bukti bayarnya.

Bukti transfer juga bisa dilihat dari Riwayat Pembayaran. Owner dan Admin and Finance bisa menautkan atau melepas bukti di sana. Sales hanya melihat.

### Pengajuan checkout

Penghuni mengajukan checkout dari Teman Rara. Pengajuannya muncul di Daftar Pengajuan Checkout.

| Status | Artinya |
|---|---|
| Menunggu | Pengajuan baru masuk |
| Disetujui (tampil On Process) | Kamu sudah menyetujui. Data belum berubah. |
| Selesai | Otomatis, begitu checkout dicatat di form Checkout |
| Ditolak | Kamu menolak dan wajib mengisi alasan |

Setelah menyetujui, klik Lanjut ke Checkout. Deposit, kondisi kamar, dan tunggakan diisi di form Checkout, bukan di panel pengajuan. Urutan lengkapnya ada di bagian C2.

### Pengumuman dan peraturan

Menu Teman Rara, Pengumuman dipakai menulis isi papan informasi penghuni.

1. Pilih Tipe. Pengumuman tampil di daftar pengumuman dan selalu urut dari yang terbaru. Peraturan tampil di beranda penghuni.
2. Isi judul (maksimal 200 karakter) dan isi (maksimal 10.000 karakter). Tulis lengkap, karena ini yang dibaca penghuni.
3. Untuk Peraturan, isi Urutan Tampil. Angka kecil tampil paling atas.
4. Klik Terbitkan. Sistem menyimpan pengumuman dan meminta Teman Rara mengirim notifikasi ke HP penghuni.
5. Kalau notifikasi gagal terkirim, pengumuman tetap tersimpan dan tampil saat penghuni membuka aplikasi.
6. Untuk mengubah, pilih entri di Papan Informasi Saat Ini lalu klik Simpan Perubahan. Notifikasi baru hanya dikirim kalau judul atau isinya benar-benar berubah.

### Akun penghuni

Menu Teman Rara, Akun Penghuni membantu menjaga siapa saja yang boleh melihat data kamar.

1. Bagian atas menampilkan empat angka: Akun aktif, Kamar terisi, Belum punya akun, dan Akun dicabut.
2. Daftar di bawahnya hanya berisi akun bermasalah. Ada dua jenis: akun ganda (lebih dari satu akun aktif untuk kamar yang sama) dan akun yatim (akun aktif milik orang yang sudah tidak tercatat sebagai penghuni aktif, biasanya mantan penghuni).
3. Klik sebuah akun untuk membuka detail. Tombol Cabut dan Pulihkan ada di dalam detail itu.
4. Cabut memutus akses penghuni ke Teman Rara seketika, jadi pastikan akunnya benar sebelum mengklik. Pulihkan hanya bisa untuk penghuni yang masih aktif.
5. Akun login penghuni sendiri tidak terhapus dari sini. Tapi akun yang dicabut tidak bisa melihat data kamar mana pun.

### Kredensial WiFi

Menu Pengaturan, Kredensial WiFi menyimpan nama jaringan (SSID) dan password per kamar. Penghuni membacanya langsung di Teman Rara. Kalau password WiFi diganti, ubah di sini supaya penghuni tidak memakai yang lama.

### Yang tidak bisa dilakukan dari Mini App

1. Menghapus akun login penghuni di Teman Rara.
2. Mengirim notifikasi langsung. Pengiriman dititipkan ke aplikasi Teman Rara.
3. Mengubah tampilan atau fitur di sisi penghuni.

---

# Bagian D. Kamus istilah {#bagian-d}

Istilah dikelompokkan menurut topik. Kalau mencari satu istilah, pakai Ctrl+F di PDF.

## D1. Istilah di web app {#d1}

| Istilah | Artinya |
|---|---|
| Role | Peran akunmu. Role menentukan menu apa yang tampil. |
| Dashboard | Halaman angka dan grafik. Hanya untuk melihat. |
| Mini App | Aplikasi tempat staf mengisi data harian. |
| Overview | Halaman ringkasan untuk satu divisi. |
| Periode | Rentang tanggal yang dipakai Dashboard: Hari ini, Minggu ini, Bulan ini, Tahun ini, atau Custom. Bawaannya Tahun ini. |
| Kartu | Kotak berisi satu angka, lengkap dengan target di bawahnya. |
| Spark | Garis kecil di dalam kartu yang menunjukkan naik turunnya angka. |
| Bar pencapaian | Batang di kartu yang menunjukkan seberapa dekat angka dengan target. |
| Pita biru dan emas | Di halaman Admin and Finance, pita biru menandai bagian Admin dan pita emas menandai bagian Finance. |
| Penghuni aktif | Penghuni yang saat ini masih menempati kamar. |
| Booking | Pemesanan kamar oleh calon penghuni. |
| DP | Uang muka booking. |
| Check-in, check-out | Penghuni masuk dan keluar kamar. |
| Pre-Check In dan Pre-Check Out | Form pemeriksaan kondisi kamar oleh Operasional sebelum penghuni masuk atau keluar. |
| Approval | Persetujuan. Hasil pemeriksaan kamar baru berlaku setelah Admin and Finance atau Owner menyetujui. |
| Deposit | Uang jaminan penghuni. Dikembalikan saat checkout, dikurangi tunggakan atau kerusakan kalau ada. |
| Invoice | Tagihan atau bukti tagihan sewa dan DP. Dikirim ke email penghuni. |
| Void | Membatalkan sebuah catatan tanpa menghapusnya. Catatan lama tetap terlihat sebagai riwayat dengan tanda Void. |
| Koreksi | Void lalu dibuatkan catatan baru yang benar. Nomor invoice koreksi memakai akhiran -K. |
| Work Order (WO) | Perintah kerja. Satu divisi melaporkan masalah dan menugaskannya ke divisi lain. |
| Tiket | Catatan perbaikan atau perawatan di Maintenance. Ada tiket preventif dan korektif. |
| Preventif | Perawatan terjadwal sebelum ada kerusakan. |
| Korektif | Perbaikan setelah ada kerusakan. |
| SLA | Batas waktu penyelesaian tiket. Saat ini 3 hari. Selesai dalam 3 hari berarti OK, lebih dari itu BREACH. |
| Prioritas | Tingkat mendesaknya pekerjaan: Rendah, Sedang, Tinggi, Darurat. |
| PIC | Penanggung jawab sebuah tugas. |
| Joblist | Daftar work order yang sedang menunggu atau dikerjakan divisimu. Tampil di Beranda Mini App. |
| Logbook | Catatan kronologis kegiatan, misalnya logbook inspeksi atau maintenance. |
| Leads | Calon penyewa yang baru menghubungi. Belum tentu jadi survey. |
| Prospek | Leads yang belum survey, ditambah yang sudah survey tapi belum booking. Satu orang satu baris. |
| Waiting list | Antrean calon penghuni yang menunggu kamar kosong. Statusnya Menunggu, Dihubungi, atau Closed. |
| COA | Daftar akun pembukuan (kas, bank, beban, pendapatan, dan seterusnya). |
| Debit dan kredit | Dua sisi pencatatan. Form Aktivitas Finansial memberi contoh di bawah tiap kolom. |
| Beban dimuka | Biaya yang dibayar sekali untuk beberapa bulan. Dicatat dulu sebagai aset, lalu dibebankan sama rata tiap bulan. |
| Aset tetap dan penyusutan | Barang bernilai besar yang dipakai bertahun-tahun, dan nilainya dikurangi sedikit demi sedikit tiap bulan. |
| Opname | Menghitung stok fisik di gudang lalu membandingkannya dengan stok di sistem. |
| Batch | Satu kali pembelian bahan. Pemakaian bisa dicatat dari batch tertentu supaya biayanya terhitung. |
| Stok minimum | Batas bawah stok. Kalau stok sama dengan atau di bawah angka ini, bahan masuk daftar stok menipis. |
| 2FA | Kode 6 digit tambahan saat masuk. |
| Teman Rara | Aplikasi untuk penghuni. Datanya satu database dengan Mini App. |
| Pendaftaran mandiri | Penghuni baru mengisi data dirinya sendiri di Teman Rara. Masuk sebagai booking berstatus Pending. |
| Bukti bayar | Foto atau PDF bukti transfer yang diunggah penghuni untuk satu invoice. Statusnya Menunggu, Terverifikasi, atau Ditolak. |
| Pengaduan | Keluhan yang dikirim penghuni lewat Teman Rara. Statusnya Menunggu, Diproses, Selesai, atau Dibatalkan. |
| On Process | Tampilan status pengajuan checkout yang sudah disetujui tapi checkout-nya belum dicatat. |
| Akun ganda | Lebih dari satu akun Teman Rara aktif untuk kamar yang sama. |
| Akun yatim | Akun Teman Rara aktif milik orang yang sudah tidak tercatat sebagai penghuni aktif. |
| SSID | Nama jaringan WiFi. |
| Notifikasi push | Pesan yang muncul di HP penghuni saat pengumuman baru diterbitkan. |

## D2. Istilah keuangan {#d2}

| Istilah | Artinya |
|---|---|
| Pendapatan kotor | Total pendapatan sebelum dikurangi diskon. Dashboard dan laporan memakai angka kotor ini. |
| Pendapatan neto | Pendapatan setelah diskon. Dipakai di kartu ringkasan Owner Review. |
| OPEX | Biaya yang terkait langsung dengan proses bisnis (listrik, gaji, perawatan, dan sejenisnya). Penyusutan dan bunga pinjaman TIDAK termasuk OPEX. |
| Penyusutan dan bunga | Beban non-operasional. Tidak masuk OPEX, hanya mengurangi laba bersih. |
| Laba bersih | Pendapatan (setelah diskon) dikurangi OPEX, penyusutan, dan bunga. |
| Margin laba bersih | Laba bersih dibagi pendapatan, dalam persen. |
| OPEX per kamar | Total OPEX dibagi jumlah kamar (30), dirata-rata per bulan. |
| Total diskon | Jumlah semua potongan harga. Ditampilkan dalam rupiah dan persen dari pendapatan. |
| Arus kas | Laporan uang yang masuk dan keluar. |
| Laba rugi | Laporan pendapatan dan beban dalam satu periode. |
| Neraca | Laporan harta, utang, dan modal pada satu tanggal. |
| PSAK | Standar akuntansi Indonesia yang menjadi acuan format laporan keuangan. |
| Collection rate | Dari semua tagihan yang jatuh tempo, berapa persen yang dibayar tepat waktu. |
| Tunggakan | Penghuni aktif yang masa sewanya sudah berakhir dan belum membayar lanjutan. Hari jatuh tempo ikut dihitung. |
| Aging tunggakan | Pengelompokan tunggakan menurut lama telatnya: 1 sampai 7 hari, 8 sampai 14 hari, 15 sampai 30 hari, dan lebih dari 30 hari. |
| Nominal tunggakan | Perkiraan, dihitung dari satu tagihan bulanan terakhir per penghuni yang menunggak. Bukan angka pasti. |
| Tutup buku | Seberapa cepat laporan resmi bulanan selesai, dihitung dalam hari kerja (Senin sampai Jumat) setelah akhir bulan. |

## D3. Istilah penjualan dan pemasaran {#d3}

| Istilah | Artinya |
|---|---|
| Konversi Leads → Survey | Dari semua leads, berapa persen yang datang survey. Target 90%. |
| Konversi Survey → Booking | Dari semua survey, berapa persen yang akhirnya booking. Target 90%. |
| Cancellation rate | Booking yang batal dibagi seluruh booking. Batas atas 20%. |
| Respons leads pertama | Rata-rata menit dari leads masuk sampai chat pertama dikirim. Target 15 menit. Leads tanpa chat pertama tidak dihitung. |
| Renewal rate | Dari penghuni yang masa sewanya jatuh tempo, berapa persen yang memperpanjang. Penghuni yang sudah keluar ikut dihitung. Target 100%. |
| Rata-rata lama sewa | Rata-rata lama tinggal semua penghuni dalam bulan. Penghuni yang belum keluar dihitung sampai hari ini. Target 3 bulan. |
| Vacancy days | Rata-rata hari kamar kosong antara penghuni lama keluar dan penghuni baru masuk. Batas atas 30 hari. |
| Okupansi | Kamar terisi dibagi seluruh kamar, dalam persen. Target 100%. |
| RevPAR | Pendapatan sewa per kamar per hari. Pendapatan sewa dibagi (jumlah kamar dikali jumlah hari). |
| CPL | Cost per lead. Uang yang dihabiskan untuk promosi dibagi leads yang didapat. Target Rp25.000. |
| CAC | Biaya untuk mendapat satu penghuni baru. (Biaya promosi ditambah biaya produksi konten) dibagi booking baru. Batas Rp50.000. |
| ROI promosi | Untung rugi promosi. (Booking dari promo dikali tarif kamar Eco, dikurangi biaya promosi) dibagi biaya promosi. Target 100%. |
| Pencapaian target leads | Leads yang didapat dibagi target leads promosi. Target 80%. |
| Engagement rate | (Like, komentar, share) dibagi reach. Target 70%. |
| Reach atau jangkauan | Berapa akun yang melihat sebuah konten. |
| Konsistensi posting | Konten yang tayang dibagi konten yang seharusnya sudah tayang. Target 100%. |
| Funnel konten | Corong dari View (jangkauan), ke Action (like, komentar, share), ke Leads. |
| Funnel penjualan | Corong dari Leads, ke Survey, ke Booking, ke Check-in. |

## D4. Istilah operasional {#d4}

| Istilah | Artinya |
|---|---|
| Resolution time | Rata-rata hari dari kerusakan terjadi sampai tiket selesai. Target 1 hari. |
| Kepatuhan SLA tiket | Tiket selesai dalam batas SLA dibagi seluruh tiket yang sudah selesai. Target 100%. |
| Kepatuhan jadwal preventif | Perawatan terjadwal yang sudah dikerjakan dibagi yang jadwalnya sudah lewat. Target 100%. |
| Kepatuhan inspeksi harian | Jumlah hari yang punya minimal satu inspeksi dibagi jumlah hari dalam periode. Target 100%. |
| Waktu prepare kamar | Rata-rata hari dari checkout sampai kamar siap disewa lagi. Target 1 hari. |
| Tiket berulang | Kasus yang sama (lokasi sama dan kategori sama) muncul dua kali atau lebih. Batas atas 2 kasus. |
| Biaya perbaikan per kamar | Total biaya perbaikan dan perawatan dibagi 30 kamar. Target Rp150.000. |
| Defect rate | Tiket korektif dibagi total tiket. |

## D5. Istilah administrasi {#d5}

| Istilah | Artinya |
|---|---|
| Dokumen penghuni lengkap | Penghuni aktif yang punya semua dokumen wajib (saat ini KTP dan Surat Kontrak) dibagi seluruh penghuni aktif. Target 100%. |
| Respons pengaduan | Rata-rata jam dari pengaduan masuk sampai ditanggapi. Target 1 jam. |
| CSAT | Skor kepuasan penghuni, skala 1 sampai 5. Diinput Admin and Finance. |
| Pelanggaran peraturan | Catatan penghuni yang melanggar tata tertib, lengkap dengan tindakannya. |
| Kecelakaan kerja | Catatan insiden yang menimpa petugas. |
