# Diagram Alir Kasus Operasional: Admin and Finance

Peran: memegang penghuni dan uang. Penghuni baru, pembayaran, checkout, pengaduan, pembukuan, dan laporan keuangan. Admin and Finance adalah penanggung jawab utama Teman Rara dari sisi pengelola.

Aplikasi yang dipakai: **Mini App** (form harian, Check-in dan Check-out, Pengaturan, Laporan, Status Kamar), **Dashboard** (Overview, Daftar Penghuni, Data Pembayaran, Daftar Vendor, Stok Inventory, Dokumen, Target KPI), **Inventory Stock** (lihat dan pembelian), **Teman Rara** (semua panel pengelola ada di Mini App).

Cara membaca diagram: kotak = langkah, belah ketupat = keputusan. Nama di awal kotak menunjukkan siapa yang mengerjakan.

| No | Kasus | Aplikasi |
|---|---|---|
| K1 | Booking langsung (walk-in atau WhatsApp) sampai penghuni masuk | Mini App |
| K2 | Pendaftaran mandiri dari Teman Rara | Teman Rara, Mini App |
| K3 | Penghuni membayar sewa atau DP | Mini App |
| K4 | Penghuni mengunggah bukti bayar | Teman Rara, Mini App |
| K5 | Perpanjangan sewa | Mini App |
| K6 | Salah catat pembayaran: void atau koreksi | Mini App |
| K7 | Penghuni mengajukan checkout | Teman Rara, Mini App |
| K8 | Pengaduan penghuni dari Teman Rara | Teman Rara, Mini App |
| K9 | Mencatat pengeluaran dan pemasukan non-sewa | Mini App |
| K10 | Biaya perbaikan dari Operasional | Mini App |
| K11 | Penagihan jatuh tempo dan tunggakan | Dashboard, Mini App |
| K12 | Tutup bulan dan laporan keuangan | Mini App, Dashboard |
| K13 | Stok menipis: belanja bahan | Inventory, Mini App |
| K14 | Pengumuman, akun ganda, dan WiFi | Teman Rara, Mini App |
| K15 | Pencatatan: pelanggaran, kecelakaan kerja, kepuasan | Mini App |
| K16 | Status kamar tidak cocok dengan kenyataan | Mini App |

---

## K1. Booking langsung (walk-in atau WhatsApp) sampai penghuni masuk

**Kapan terjadi:** calon penghuni survey lalu setuju, atau memesan lewat WhatsApp.

```mermaid
flowchart TD
    A["Admin: Penghuni Baru dan Review, form atas<br/>nama, HP, kamar, tgl masuk, durasi, harga, sumber leads"] --> B{"Kamar tersedia di pilihan?"}
    B -->|"tidak"| C["Kamar Terisi, Booking, atau Maintenance:<br/>pilih kamar lain atau Sales isi Waiting List"]
    B -->|"ya"| D["Simpan sebagai booking, status Pending atau Konfirmasi<br/>(Check-in tidak bisa dipilih dari form ini)"]
    D --> E["Status kamar jadi Booking"]
    E --> F["Admin: bila masih Pending, klik Konfirmasi di panel Review"]
    F --> G["Operasional: Pre-Check In Form"]
    G --> H["Admin atau Owner: Approval Check-in"]
    H --> I{"Disetujui?"}
    I -->|"tidak"| J["Operasional periksa ulang lalu ajukan lagi"]
    I -->|"ya"| K["Admin: Daftar Booking, klik Check-in<br/>(aktif bila Konfirmasi dan inspeksi disetujui)"]
    J --> G
    K --> L["Penghuni aktif terbentuk, kamar Terisi,<br/>data Teman Rara disalin ke penghuni"]
```

**Checklist**
- [ ] Tambahan listrik per bulan dan nama barang elektronik tambahan diisi bila ada.
- [ ] Nopol dan nama kendaraan diisi bila ada (satu nopol satu penghuni aktif).
- [ ] Dokumen identitas dan kontrak diunggah (maksimal 2 MB per berkas).
- [ ] Tombol Check-in abu-abu: arahkan kursor, alasannya tertulis.

**Perhatikan:** Check-in tidak bisa dicatat dari form Penghuni Baru maupun Edit Data. Hanya lewat Daftar Booking setelah SOP selesai.

---

## K2. Pendaftaran mandiri dari Teman Rara

**Kapan terjadi:** calon penghuni mengisi form sendiri di Teman Rara. Masuk sebagai booking berstatus Pending.

```mermaid
flowchart TD
    A["Penghuni: isi form di Teman Rara<br/>(data diri, bukti DP)"] --> B["Admin: buka panel bawah<br/>Penghuni Baru dan Review"]
    B --> C["Tinjau data diri, kontak darurat,<br/>kendaraan, identitas, bukti DP"]
    C --> D{"Data benar?"}
    D -->|"tidak"| E["Klik Tolak dan isi alasan"]
    D -->|"ya"| F{"Membawa barang elektronik?"}
    F -->|"ya"| G["Isi Tambahan Listrik per bulan<br/>dan Nama Barang Tambahan"]
    F -->|"tidak"| H["Klik Konfirmasi"]
    G --> H
    E --> I["Booking Dibatalkan, kamar bebas lagi,<br/>naik di Cancellation Rate Sales"]
    H --> J["Booking Konfirmasi, kamar Booking"]
    J --> K["Lanjut SOP Check-in:<br/>Pre-Check In, Approval, lalu Check-in"]
```

**Perhatikan:** Konfirmasi belum membuat penghuni. Penghuni terbentuk saat tombol Check-in ditekan. Saat itu hanya kolom kosong yang disalin dari Teman Rara, jadi koreksi manual tidak tertimpa. Nopol yang formatnya tidak dikenali atau sudah dipakai penghuni lain tidak disalin: isi manual di Ubah Data Penghuni.

---

## K3. Penghuni membayar sewa atau DP

**Kapan terjadi:** uang masuk dari penghuni atau calon penghuni.

```mermaid
flowchart TD
    A["Admin: Pembayaran dan Verifikasi"] --> B{"Jenis pembayaran"}
    B -->|"Sewa"| C["Pilih penghuni dan lama sewa<br/>periode awal terisi dari tanggal habis sewa terakhir"]
    B -->|"DP"| D["Isi nama, WhatsApp, email,<br/>nomor kamar, tanggal masuk"]
    C --> E["Isi denda, pajak, atau diskon bila ada"]
    D --> E
    E --> F["Pilih akun kas atau bank tujuan"]
    F --> G["Periksa preview<br/>(nominal ditentukan sistem, bukan diketik)"]
    G --> H{"Preview benar?"}
    H -->|"tidak"| I["Perbaiki isian"]
    H -->|"ya"| J["Konfirmasi"]
    I --> G
    J --> K["Invoice terbit dan dikirim ke penghuni,<br/>jurnal pengakuan sewa tercatat"]
```

**Checklist**
- [ ] Periode Awal Sewa tidak diubah kecuali memang berbeda.
- [ ] Diskon, pajak, dan denda hanya diisi bila ada.
- [ ] Setelah konfirmasi, tunggu pesan sukses sebelum menutup halaman.

**Perhatikan:** DP otomatis 50% dari tarif 1 bulan. Diskon tercatat sebagai pengurang pendapatan, bukan beban.

---

## K4. Penghuni mengunggah bukti bayar

**Kapan terjadi:** penghuni transfer lalu mengunggah bukti di Teman Rara.

```mermaid
flowchart TD
    A["Penghuni: unggah bukti transfer di Teman Rara"] --> B["Admin: panel Verifikasi Bukti Bayar<br/>di bawah form Pembayaran"]
    B --> C{"Bukti cocok dengan mutasi<br/>dan invoice?"}
    C -->|"tidak"| D["Tolak dan isi alasan<br/>(5 sampai 500 karakter)"]
    C -->|"ya"| E["Klik Verifikasi"]
    E --> F["Bukti ditandai sah"]
    F --> G["Catat pembayarannya lewat form di atas<br/>(verifikasi tidak mencatat pembayaran)"]
    D --> H["Penghuni diminta mengunggah ulang"]
    G --> I{"Salah menekan keputusan?"}
    I -->|"ya"| J["Aksi batal, bukti kembali ke antrean"]
    I -->|"tidak"| K["Selesai"]
```

**Perhatikan:** invoice yang sudah di-void tidak bisa diunggah bukti bayarnya. Bukti juga bisa ditautkan atau dilepas di Riwayat Pembayaran.

---

## K5. Perpanjangan sewa

**Kapan terjadi:** sewa penghuni mendekati jatuh tempo (muncul di Daftar Jatuh Tempo 7 hari ke depan).

```mermaid
flowchart TD
    A["Dashboard: penghuni masuk Daftar Jatuh Tempo"] --> B["Sales: ingatkan penghuni memperpanjang"]
    B --> C{"Penghuni memperpanjang?"}
    C -->|"ya"| D["Admin: Pembayaran dan Verifikasi, jenis Sewa,<br/>periode awal otomatis lanjut dari habis sewa"]
    C -->|"tidak"| E["Penghuni mengajukan checkout"]
    D --> F["Invoice terbit, Renewal Rate Sales naik"]
    E --> G["Lanjut alur checkout (K7)"]
```

---

## K6. Salah catat pembayaran: void atau koreksi

**Kapan terjadi:** nominal atau periode salah, atau pembayaran batal. Hanya Owner dan Admin and Finance yang bisa.

```mermaid
flowchart TD
    A["Admin: Riwayat Pembayaran"] --> B["Cari invoice penghuni"]
    B --> C{"Pembayaran masih berlaku<br/>tapi datanya salah?"}
    C -->|"ya"| D["Koreksi dan isi alasan"]
    C -->|"tidak, batal"| E["Void dan isi alasan"]
    D --> F["Invoice lama di-void,<br/>invoice baru akhiran -K terbit sebagai REVISI"]
    E --> G["Invoice Void, jurnal dibalik,<br/>email DIBATALKAN ke penghuni"]
    F --> H["Void tidak dihitung sebagai tagihan,<br/>tunggakan, atau pengingat"]
    G --> H
    H --> I["Laporan yang sudah diarsipkan tidak berubah,<br/>buat ulang bila perlu"]
```

**Perhatikan:** jangan membuat entri ganda untuk menimpa yang lama. Salah tautan bukti transfer: lepas di Riwayat Pembayaran, berkas di Drive tidak terhapus.

---

## K7. Penghuni mengajukan checkout

**Kapan terjadi:** penghuni mengajukan keluar di Teman Rara, atau Admin mencatat langsung.

```mermaid
flowchart TD
    A["Penghuni: ajukan checkout di Teman Rara"] --> B["Admin: Daftar Pengajuan Checkout"]
    B --> C{"Setujui?"}
    C -->|"tolak"| D["Isi alasan wajib, status Ditolak"]
    C -->|"setujui"| E["Status Disetujui (tampil On Process)"]
    E --> F["Operasional: Pre-Check Out Form"]
    F --> G["Admin atau Owner: Approval Check-out"]
    G --> H{"Ada kerusakan?"}
    H -->|"tidak"| I["Setujui, deposit kembali penuh"]
    H -->|"ya"| J["Setujui, isi deposit dikembalikan<br/>dan catatan potongan"]
    I --> K["Admin: klik Lanjut ke Checkout,<br/>isi form Checkout"]
    J --> K
    K --> L["Penghuni tidak aktif, pengajuan otomatis Selesai"]
    L --> M["Kamar Kosong, atau tetap Maintenance<br/>bila ada temuan kerusakan"]
    M --> N["Operasional: Kamar Siap Sewa"]
```

**Checklist**
- [ ] Tunggakan terisi otomatis dari riwayat pembayaran, periksa sebelum simpan.
- [ ] Deposit diputuskan di Approval Check-out, bukan di form Checkout.
- [ ] Pengembalian deposit tidak bisa melebihi deposit asli (dibaca dari database).

---

## K8. Pengaduan penghuni dari Teman Rara

**Kapan terjadi:** penghuni aktif mengirim pengaduan. Target tanggapan paling lama 1 jam.

```mermaid
flowchart TD
    A["Penghuni aktif: kirim pengaduan di Teman Rara"] --> B["Admin: panel bawah Feedback dan Pengaduan"]
    B --> C["Baca isi, kategori, dan foto"]
    C --> D{"Kategori Listrik, Air, AC,<br/>atau Fasilitas?"}
    D -->|"ya"| E["Ubah status ke Diproses"]
    D -->|"tidak"| F["Ubah status ke Diproses<br/>(kamar tidak berubah status)"]
    E --> G["Kamar penghuni otomatis Maintenance"]
    G --> H["Operasional: buat work order atau tiket"]
    F --> I["Tulis tanggapan dan klik Simpan Tanggapan"]
    H --> I
    I --> J["Tanggapan tampil di aplikasi penghuni,<br/>waktu simpan dihitung ke Respons Pengaduan"]
    J --> K{"Masalah teratasi?"}
    K -->|"ya"| L["Isi tanggapan penutup, status Selesai"]
    K -->|"tidak"| M["Tetap Diproses, tanggapi perkembangan"]
    L --> N["Kamar kembali ke status semula<br/>bila tidak ada pemicu Maintenance lain"]
```

**Checklist**
- [ ] Tanggapan diisi sebelum status Selesai atau Dibatalkan (wajib).
- [ ] Pengaduan dari penghuni yang sudah tidak aktif tidak mengubah status kamar (muncul peringatan).
- [ ] Komplain lisan dicatat di form atas Feedback dan Pengaduan. Saran dan kritik masuk log feedback.

---

## K9. Mencatat pengeluaran dan pemasukan non-sewa

**Kapan terjadi:** bayar listrik, internet, gaji, belanja, atau terima uang di luar sewa (mis. laundry).

```mermaid
flowchart TD
    A["Admin: Aktivitas Finansial"] --> B{"Jenis aktivitas"}
    B -->|"Pengeluaran"| C["Pilih akun tujuan dan sumber,<br/>nominal, keterangan, kategori, divisi pengeluar"]
    B -->|"Pemasukan"| D["Isi nama transaksi, jumlah,<br/>kas penerima, akun pendapatan"]
    C --> E{"Dibayar di muka<br/>untuk beberapa bulan?"}
    E -->|"ya"| F["Centang Beban dimuka dan isi jumlah bulan<br/>(maksimal 240), diamortisasi tiap bulan"]
    E -->|"tidak"| G["Unggah nota bila ada"]
    F --> G
    G --> H["Simpan, nomor nota otomatis<br/>tahun-bulan, divisi, urutan"]
    D --> I["Simpan"]
    H --> J["Masuk Laba Rugi, Arus Kas, dan Dashboard"]
    I --> J
```

**Perhatikan:** penyusutan dan bunga pinjaman bukan OPEX. Keduanya hanya mengurangi laba bersih.

---

## K10. Biaya perbaikan dari Operasional

**Kapan terjadi:** tiket perawatan atau perbaikan diisi dengan biaya lebih dari nol. Biaya tidak langsung masuk pembukuan.

```mermaid
flowchart TD
    A["Operasional: isi tiket dengan biaya"] --> B["Sistem membuat work order<br/>tujuan Admin, status Pending"]
    B --> C["Admin: lihat di Joblist Beranda"]
    C --> D["Cocokkan dengan nota dan pelaksana"]
    D --> E{"Biaya sah?"}
    E -->|"ya"| F["Catat di Aktivitas Finansial<br/>(pengeluaran, divisi Maintenance)"]
    E -->|"tidak"| G["Konfirmasi ke Operasional"]
    F --> H["Ubah status work order ke Complete"]
    G --> D
```

**Perhatikan:** work order ini membawa referensi tiket asal. Bila tertulis gagal masuk Joblist Admin, catat pengeluaran manual dengan referensi tiket.

---

## K11. Penagihan jatuh tempo dan tunggakan

**Kapan terjadi:** pemeriksaan mingguan.

```mermaid
flowchart TD
    A["Admin: Dashboard Admin and Finance"] --> B["Lihat Daftar Jatuh Tempo<br/>dan Aging Tunggakan"]
    B --> C{"Ada penghuni telat atau<br/>jatuh tempo 7 hari?"}
    C -->|"tidak"| D["Selesai"]
    C -->|"ya"| E["Hubungi penghuni lewat WhatsApp"]
    E --> F{"Penghuni membayar?"}
    F -->|"ya"| G["Catat di Pembayaran dan Verifikasi"]
    F -->|"janji"| H["Catat janji bayar, tagih ulang"]
    F -->|"tidak ada kabar"| I["Laporkan ke Owner"]
    G --> J["Collection Rate naik"]
```

**Perhatikan:** target Collection Rate 100% dan penghuni menunggak paling banyak 2.

---

## K12. Tutup bulan dan laporan keuangan

**Kapan terjadi:** akhir sampai awal bulan. Target tutup buku 1 hari kerja setelah akhir bulan.

```mermaid
flowchart TD
    A["Admin: Aset Tetap dan Penyusutan,<br/>posting penyusutan bulanan"] --> B["Pastikan semua pembayaran<br/>dan aktivitas finansial bulan itu tercatat"]
    B --> C["Isi Kepuasan Penghuni untuk penghuni aktif"]
    C --> D["Laporan: pilih periode, Generate dan Arsipkan<br/>Arus Kas, Laba Rugi, Neraca"]
    D --> E{"Bulan sudah berakhir?"}
    E -->|"belum"| F["Hanya Pratinjau dan Unduh PDF"]
    E -->|"ya"| G["Laporan tercatat di riwayat dan Drive"]
    G --> H["Tutup buku dihitung dari tanggal<br/>laporan resmi pertama dibuat"]
    H --> I["Tanggal 1 sampai 3: sistem membuat sisanya<br/>dan mengirim email PDF ke penerima"]
```

**Checklist**
- [ ] Penyusutan bulan ini sudah diposting.
- [ ] Tidak ada pembayaran atau pengeluaran yang tertunda dicatat.
- [ ] Email tujuan laporan benar (diatur Owner).

---

## K13. Stok menipis: belanja bahan

**Kapan terjadi:** Operasional melaporkan stok menipis, atau Dashboard Stok Inventory menampilkan bahan di bawah batas minimum.

```mermaid
flowchart TD
    A["Operasional: sampaikan stok menipis"] --> B["Admin: cek Dashboard Inventory<br/>atau Stok Inventory di Dashboard"]
    B --> C["Belanja bahan"]
    C --> D["Inventory, Pembelian: pilih bahan,<br/>jumlah, tanggal, harga total"]
    D --> E["Harga per satuan terhitung, stok bertambah<br/>sebagai satu batch"]
    E --> F["Catat belanjanya di Aktivitas Finansial<br/>bila harus masuk pembukuan"]
```

**Perhatikan:** Inventory tidak membuat jurnal keuangan otomatis, jadi pembelian di sana tidak ikut masuk Laba Rugi. Catat belanja di Aktivitas Finansial bila ingin tercatat di pembukuan.

---

## K14. Pengumuman, akun ganda, dan WiFi

**Kapan terjadi:** informasi untuk penghuni, akun Teman Rara bermasalah, atau password WiFi diganti.

```mermaid
flowchart TD
    A["Admin: menu Teman Rara"] --> B{"Keperluan"}
    B -->|"Pengumuman atau peraturan"| C["Pengumuman: isi, Terbitkan<br/>notifikasi dikirim ke HP penghuni"]
    B -->|"Akun penghuni"| D["Akun Penghuni: lihat akun ganda dan akun yatim"]
    B -->|"Password WiFi diganti"| E["Pengaturan, Kredensial WiFi:<br/>ubah SSID dan password per kamar"]
    D --> F{"Akun milik mantan penghuni<br/>atau ganda?"}
    F -->|"ya"| G["Buka detail dan klik Cabut<br/>(akses terputus seketika)"]
    F -->|"tidak"| H["Biarkan"]
    G --> I["Pulihkan hanya untuk penghuni yang masih aktif"]
```

---

## K15. Pencatatan: pelanggaran, kecelakaan kerja, kepuasan

**Kapan terjadi:** kejadian pelanggaran peraturan, kecelakaan kerja, atau survei kepuasan bulanan.

```mermaid
flowchart TD
    A["Admin: pilih form di Mini App"] --> B{"Kejadian"}
    B -->|"Pelanggaran penghuni"| C["Pelanggaran Peraturan: tanggal, penghuni,<br/>jenis, deskripsi, tindakan"]
    B -->|"Kecelakaan kerja"| D["Kecelakaan Kerja: tanggal, lokasi, petugas,<br/>kronologi, tindakan"]
    B -->|"Survei bulanan"| E["Kepuasan Penghuni: skor 1 sampai 5<br/>per penghuni per bulan"]
    C --> F{"Jenis pelanggaran belum ada?"}
    F -->|"ya"| G["Pengaturan, Jenis Pelanggaran: tambah jenis"]
    F -->|"tidak"| H["Simpan"]
    G --> C
    D --> H
    E --> H
    H --> I["Masuk laporan Kinerja Admin dan Owner Review"]
```

---

## K16. Status kamar tidak cocok dengan kenyataan

**Kapan terjadi:** kamar tertulis Kosong padahal ada booking, atau data lama belum selaras.

```mermaid
flowchart TD
    A["Admin: Mini App, Status Kamar"] --> B["Klik Selaraskan semua kamar"]
    B --> C["Baca pratinjau perubahan<br/>(mis. Kamar 7: Kosong menjadi Booking)"]
    C --> D{"Perubahan masuk akal?"}
    D -->|"ya"| E["Konfirmasi"]
    D -->|"tidak"| F["Batal, periksa data booking atau penghuni"]
    E --> G["Status kamar cocok dengan penghuni aktif<br/>dan booking yang ada"]
    G --> H["Kamar tertulis Maintenance tanpa pemicu<br/>tidak diubah, hanya dilaporkan: cek manual"]
```

---

## Ringkasan: kasus, KPI, dan hal yang perlu dicek

| Kasus | KPI terkait | Target |
|---|---|---|
| K1, K2 | Kamar kosong | 0 |
| K3, K11 | Collection Rate, penghuni menunggak | 100%, paling banyak 2 |
| K3, K9 | Pendapatan, laba bersih | Rp26 juta, Rp15 juta per bulan |
| K3 | Total diskon | Paling tinggi 10% dari pendapatan |
| K8 | Respons pengaduan | Paling lama 1 jam |
| K9, K10 | OPEX per kamar | Paling tinggi Rp300 ribu per bulan |
| K12 | Tutup buku | 1 hari kerja setelah akhir bulan |
| K1, K15 | Dokumen penghuni lengkap | 100% |
