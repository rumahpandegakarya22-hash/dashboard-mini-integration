# Diagram Alir Kasus Operasional: Owner

Peran: memantau seluruh kost, memegang keputusan yang tidak dipegang role lain (harga kamar, akun dan role, penerima laporan, koreksi stok), dan menjadi cadangan persetujuan.

Aplikasi yang dipakai: **Dashboard** (semua halaman), **Mini App** (semua form dan menu), **Inventory Stock** (semua menu), **Teman Rara** (dikelola lewat panel di Mini App).

Cara membaca diagram: kotak = langkah, belah ketupat = keputusan, panah berlabel = pilihan. Nama di awal kotak (mis. "Admin:") menunjukkan siapa yang mengerjakan.

| No | Kasus | Aplikasi |
|---|---|---|
| K1 | Staf baru mendaftar akun | Mini App, Dashboard |
| K2 | Pantauan harian dan angka yang janggal | Dashboard |
| K3 | Mengubah harga kamar | Mini App |
| K4 | Menggantikan persetujuan saat Admin and Finance berhalangan | Mini App |
| K5 | Peringatan kuning di Beranda | Mini App, Teman Rara |
| K6 | Menerbitkan pengumuman ke penghuni | Mini App, Teman Rara |
| K7 | Salah catat pembayaran: void atau koreksi | Mini App |
| K8 | Siklus laporan bulanan dan Owner Review | Mini App, Dashboard |
| K9 | Mengatur target KPI dan kepala divisi | Dashboard |
| K10 | Opname stok akhir bulan dan selisih stok | Inventory |
| K11 | Memeriksa status kamar | Mini App, Dashboard |

---

## K1. Staf baru mendaftar akun

**Kapan terjadi:** ada karyawan baru atau staf yang akunnya belum aktif (layar "Menunggu Persetujuan").

```mermaid
flowchart TD
    A["Staf: daftar akun lalu aktifkan 2FA"] --> B["Staf: layar Menunggu Persetujuan"]
    B --> C["Owner: buka Kelola User di Mini App"]
    C --> D{"Orang ini dikenal<br/>dan memang perlu akses?"}
    D -->|"tidak"| E["Owner: biarkan atau nonaktifkan akun"]
    D -->|"ya"| F["Owner: setujui dan pilih role"]
    F --> G{"Perlu lihat Dashboard?"}
    G -->|"ya"| H["Owner: buka akses Dashboard<br/>(diatur terpisah dari Mini App)"]
    G -->|"tidak"| I["Selesai: staf keluar lalu masuk lagi"]
    H --> J{"Kepala divisi?"}
    J -->|"ya"| K["Owner: Dashboard, Akun dan Keamanan,<br/>Jadikan kepala divisi (boleh ubah target KPI divisinya)"]
    J -->|"tidak"| I
    K --> I
```

**Checklist**
- [ ] Role sesuai tugas (Admin and Finance, Sales, Marketing, Operasional, Pengawas).
- [ ] Akses Dashboard dibuka kalau staf perlu melihat angka.
- [ ] Staf sudah scan 2FA (satu kali berlaku untuk Dashboard dan Mini App).

**Perhatikan:** Pengawas hanya ada di Dashboard dan tidak punya akses Mini App. Staf yang bisa masuk Mini App tapi ditolak Dashboard hampir selalu belum dibukakan akses Dashboard.

---

## K2. Pantauan harian dan angka yang janggal

**Kapan terjadi:** setiap hari, atau saat angka di Overview terasa tidak masuk akal.

```mermaid
flowchart TD
    A["Owner: buka Dashboard Overview<br/>pilih periode"] --> B["Baca okupansi, tiket aktif,<br/>pendapatan, laba, OPEX"]
    B --> C{"Ada kartu yang janggal?"}
    C -->|"tidak"| D["Selesai"]
    C -->|"ya"| E{"Kartu menampilkan strip?"}
    E -->|"ya"| F["Belum ada data di periode itu:<br/>tanya divisi apakah form sudah diisi"]
    E -->|"tidak"| G["Buka halaman divisi terkait<br/>(Sales, Marketing, Admin and Finance, Operasional)"]
    G --> H{"KPI di bawah target?"}
    H -->|"ya"| I["Hubungi kepala divisi,<br/>minta penjelasan dan rencana"]
    H -->|"tidak"| J["Cek periode dan tombol muat ulang"]
    F --> K["Catat tindak lanjut"]
    I --> K
    J --> K
```

**Checklist**
- [ ] Periode yang dipilih benar (bawaan: Tahun ini).
- [ ] Strip diperlakukan sebagai "belum ada data", bukan nol.
- [ ] Temuan dicatat dan ditindaklanjuti di rapat mingguan.

---

## K3. Mengubah harga kamar

**Kapan terjadi:** penyesuaian tarif per tipe kamar atau per durasi sewa. Hanya Owner yang bisa.

```mermaid
flowchart TD
    A["Owner: buka Kelola Harga Kamar"] --> B["Pilih tipe kamar"]
    B --> C["Ubah tarif total untuk tiap durasi<br/>(bukan tarif per bulan)"]
    C --> D{"Tarif antar kamar setipe<br/>sebelumnya berbeda?"}
    D -->|"ya"| E["Peringatan: menyimpan akan<br/>menyeragamkan semua kamar setipe"]
    D -->|"tidak"| F["Simpan"]
    E --> F
    F --> G["DP otomatis 50% dari tarif 1 bulan"]
    G --> H["Invoice baru memakai tarif baru"]
    H --> I{"Invoice lama yang sudah terbit?"}
    I -->|"ya"| J["Tidak berubah. Koreksi lewat<br/>Riwayat Pembayaran bila perlu"]
    I -->|"tidak"| K["Selesai"]
```

**Checklist**
- [ ] Angka yang dimasukkan adalah total untuk seluruh durasi.
- [ ] Admin and Finance diberi tahu tanggal berlaku tarif baru.
- [ ] Harga yang disepakati di booking wajar terhadap tarif (sistem menolak harga kurang dari 50% atau lebih dari 200% tarif).

---

## K4. Menggantikan persetujuan saat Admin and Finance berhalangan

**Kapan terjadi:** Approval Check-in, Approval Check-out, atau pengajuan checkout menunggu terlalu lama.

```mermaid
flowchart TD
    A["Owner: lihat Approval yang menunggu<br/>di Mini App"] --> B{"Jenis persetujuan"}
    B -->|"Check-in"| C["Approval Check-in:<br/>baca hasil Pre-Check In dari Operasional"]
    B -->|"Check-out"| D["Approval Check-out:<br/>baca hasil Pre-Check Out"]
    B -->|"Pengajuan checkout"| E["Daftar Pengajuan Checkout:<br/>Setujui atau Tolak (alasan wajib)"]
    C --> F{"Kondisi kamar layak?"}
    F -->|"ya"| G["Setujui"]
    F -->|"tidak"| H["Tolak dan minta Operasional periksa ulang"]
    D --> I{"Ada kerusakan dibanding kondisi awal?"}
    I -->|"tidak"| J["Setujui, deposit kembali penuh"]
    I -->|"ya"| K["Setujui dan isi pengembalian deposit<br/>sesuai potongan, tulis catatan"]
    G --> L["Admin and Finance: Check-in di Daftar Booking"]
    J --> M["Admin and Finance: lanjut ke form Checkout"]
    K --> M
```

**Perhatikan:** nominal deposit dibaca sistem dari database, sehingga pengembalian tidak bisa melebihi deposit asli.

---

## K5. Peringatan kuning di Beranda

**Kapan terjadi:** Beranda Mini App menampilkan pengajuan checkout yang menunggu atau pengaduan yang belum selesai.

```mermaid
flowchart TD
    A["Owner: lihat peringatan kuning di Beranda"] --> B{"Jenis peringatan"}
    B -->|"Pengaduan belum selesai"| C["Klik peringatan, buka panel Pengaduan"]
    B -->|"Pengajuan checkout menunggu"| D["Klik peringatan, buka Daftar Pengajuan Checkout"]
    C --> E{"Sudah ada tanggapan dari Admin and Finance?"}
    E -->|"ya"| F["Pantau saja sampai status Selesai"]
    E -->|"tidak, lebih dari 1 jam"| G["Hubungi Admin and Finance<br/>atau tanggapi sendiri"]
    D --> H{"Menunggu lama tanpa keputusan?"}
    H -->|"ya"| I["Setujui atau tolak sendiri"]
    H -->|"tidak"| J["Pantau"]
    G --> K["Target Respons Pengaduan: paling lama 1 jam"]
```

**Perhatikan:** angka peringatan yang tinggi dan lama tidak turun menandakan penanganan terlambat. Itu bahan evaluasi mingguan.

---

## K6. Menerbitkan pengumuman ke penghuni

**Kapan terjadi:** perubahan peraturan, pemadaman, atau informasi umum. Owner boleh menerbitkan bila Admin and Finance berhalangan.

```mermaid
flowchart TD
    A["Owner: Teman Rara, Pengumuman"] --> B["Pilih tipe: Pengumuman atau Peraturan"]
    B --> C["Isi judul dan isi lengkap"]
    C --> D{"Tipe Peraturan?"}
    D -->|"ya"| E["Isi Urutan Tampil<br/>(angka kecil tampil paling atas)"]
    D -->|"tidak"| F["Periksa ulang isi"]
    E --> F
    F --> G["Klik Terbitkan"]
    G --> H["Sistem simpan dan minta Teman Rara<br/>kirim notifikasi ke HP penghuni"]
    H --> I{"Notifikasi terkirim?"}
    I -->|"ya"| J["Penghuni menerima notifikasi"]
    I -->|"tidak"| K["Pengumuman tetap tersimpan,<br/>tampil saat penghuni buka aplikasi"]
```

**Perhatikan:** pengumuman Owner ikut mengirim notifikasi ke HP seluruh penghuni, jadi baca ulang sebelum klik Terbitkan. Mengubah isi hanya mengirim notifikasi baru kalau judul atau isinya benar-benar berubah.

---

## K7. Salah catat pembayaran: void atau koreksi

**Kapan terjadi:** nominal, penghuni, atau periode salah; atau pembayaran memang batal. Prinsipnya: catatan keuangan tidak dihapus.

```mermaid
flowchart TD
    A["Owner: buka Riwayat Pembayaran"] --> B["Cari invoice penghuni"]
    B --> C{"Pembayaran masih berlaku<br/>tapi datanya salah?"}
    C -->|"ya"| D["Pilih Koreksi, isi alasan"]
    C -->|"tidak, memang batal"| E["Pilih Void, isi alasan"]
    D --> F["Invoice lama di-void,<br/>invoice baru akhiran -K terbit"]
    E --> G["Invoice ditandai Void,<br/>jurnal dibalik"]
    F --> H["Penghuni menerima email REVISI"]
    G --> I["Penghuni menerima email DIBATALKAN"]
    H --> J["Void tidak dihitung sebagai<br/>tagihan, tunggakan, atau pengingat"]
    I --> J
    J --> K["Laporan yang sudah diarsipkan tidak berubah,<br/>hanya yang dibuat ulang"]
```

**Checklist**
- [ ] Alasan diisi jelas (wajib).
- [ ] Bukti transfer yang salah tautan dilepas dari invoice (berkas di Drive tidak terhapus).
- [ ] Laporan bulan itu dibuat ulang bila angkanya sudah diarsipkan.

---

## K8. Siklus laporan bulanan dan Owner Review

**Kapan terjadi:** tiap awal bulan.

```mermaid
flowchart TD
    A["Tanggal 1, 2, 3 pukul 08.00 WIB:<br/>sistem membuat laporan bulan lalu"] --> B{"Semua laporan berhasil dibuat?"}
    B -->|"belum"| C["Tanggal berikutnya hanya mengulang yang gagal.<br/>Email ditunda sampai semuanya berhasil"]
    B -->|"ya"| D["Sistem kirim email PDF 14 laporan<br/>ke penerima yang diatur Owner"]
    C --> B
    D --> E["Owner: baca Owner Review"]
    E --> F["Lihat scorecard KPI per divisi<br/>dan daftar KPI belum tercapai"]
    F --> G{"Bagian Kualitas Data muncul?"}
    G -->|"ya"| H["Ada data kosong:<br/>minta divisi melengkapi form yang terlewat"]
    G -->|"tidak"| I["Data lengkap"]
    H --> J["Putuskan tindak lanjut dan rekomendasi"]
    I --> J
```

**Checklist awal bulan**
- [ ] Email penerima laporan masih benar (panel Email Tujuan di bagian atas halaman Laporan, maksimal 10 alamat).
- [ ] Owner Review dibaca. Hanya Owner yang bisa membuat dan melihatnya.
- [ ] Bulan berjalan belum bisa di-Generate & Arsipkan, hanya Pratinjau dan Unduh PDF.

---

## K9. Mengatur target KPI dan kepala divisi

**Kapan terjadi:** SOW divisi berubah atau target perlu disesuaikan.

```mermaid
flowchart TD
    A["Owner: Dashboard, halaman Target KPI"] --> B{"Ubah sendiri<br/>atau delegasikan?"}
    B -->|"ubah sendiri"| C["Pilih divisi dan KPI, ubah angka target, simpan"]
    B -->|"delegasikan"| D["Dashboard, Akun dan Keamanan:<br/>Jadikan kepala divisi"]
    D --> E["Kepala divisi boleh ubah target<br/>divisinya sendiri"]
    C --> F["Kartu Dashboard, scorecard, dan laporan<br/>memakai target baru"]
    E --> F
    F --> G["Laporan yang sudah diarsipkan<br/>tidak ikut berubah"]
```

---

## K10. Opname stok akhir bulan dan selisih stok

**Kapan terjadi:** akhir bulan, atau stok di sistem tidak sama dengan hitungan fisik. Pembelian dan pemakaian sehari-hari dikerjakan Admin and Finance dan Operasional.

```mermaid
flowchart TD
    A["Owner: Inventory, Laporan Opname"] --> B["Buat laporan untuk satu periode<br/>(Stok Sistem terisi otomatis)"]
    B --> C["Staf hitung fisik di gudang"]
    C --> D["Owner: isi Stok Fisik<br/>selisih terhitung otomatis"]
    D --> E{"Ada selisih?"}
    E -->|"ya"| F["Isi keterangan, lalu Koreksi Stok<br/>dengan alasan jelas"]
    E -->|"tidak"| G["Simpan Draf"]
    F --> H["Cek Log Aktivitas:<br/>siapa mengubah apa"]
    H --> G
    G --> I{"Semua benar?"}
    I -->|"ya"| J["Finalisasi: status FINALIZED,<br/>tidak bisa diubah lagi"]
    I -->|"belum"| D
    J --> K["Cetak PDF: tanda tangan staf dan Owner"]
```

**Perhatikan:** hanya Owner yang bisa menambah atau mengubah bahan dan alat, Koreksi Stok, Laporan Opname, dan Log Aktivitas.

---

## K11. Memeriksa status kamar

**Kapan terjadi:** ingin tahu kenapa kamar tidak bisa dibooking, atau status kamar tidak cocok dengan kenyataan.

```mermaid
flowchart TD
    A["Owner: Mini App, menu Status Kamar"] --> B["Lihat status tiap kamar<br/>dan pemicu Maintenance yang terbuka"]
    B --> C{"Status cocok dengan kenyataan?"}
    C -->|"ya"| D["Selesai"]
    C -->|"tidak, banyak kamar"| E["Klik Selaraskan semua kamar,<br/>baca pratinjau, lalu konfirmasi"]
    C -->|"tidak, satu kamar Maintenance"| F{"Pemicu otomatisnya sudah beres?"}
    F -->|"ya"| G["Klik Selesai Maintenance<br/>(menutup semua pemicu kamar itu)"]
    F -->|"belum"| H["Minta Operasional atau Admin and Finance<br/>menyelesaikan pemicunya"]
    E --> D
    G --> D
    H --> D
```

---

## Ringkasan: kasus, siapa terlibat, dan KPI yang dipantau

| Kasus | Role lain yang terlibat | KPI Owner yang terpengaruh |
|---|---|---|
| K1 | Staf baru | (akses) |
| K2 | Semua divisi | Pendapatan Rp26 juta per bulan, laba Rp15 juta, okupansi 100% |
| K3 | Admin and Finance | Pendapatan, RevPAR, margin |
| K4, K5 | Admin and Finance, Operasional | Kepuasan penghuni, respons pengaduan |
| K7 | Admin and Finance | Pendapatan, laba |
| K8, K9 | Semua kepala divisi | Seluruh KPI |
| K10 | Admin and Finance, Operasional | OPEX per kamar paling tinggi Rp300 ribu |
| K11 | Operasional | Kamar kosong 0, okupansi |
