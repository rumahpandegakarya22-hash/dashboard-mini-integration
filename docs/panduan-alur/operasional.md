# Diagram Alir Kasus Operasional: Operasional

Peran: menjaga kamar dan fasilitas layak huni. Satu role mencakup **Maintenance, Inspeksi, dan Cleaning**.

Aplikasi yang dipakai: **Mini App** (form perawatan, perbaikan, inspeksi, work order, Kamar Siap Sewa, Pemakaian Stok, Tambah Vendor, Kecelakaan Kerja, Tugas Harian, Pre-Check In dan Pre-Check Out, Status Kamar, Joblist di Beranda), **Dashboard** (Overview, Daftar Tiket, Daftar Vendor, Stok Inventory, Data Kamar, Dokumen, Target KPI), **Inventory Stock** (Dashboard, Daftar Bahan, Daftar Alat, Pembelian, Pemakaian). **Teman Rara** tidak punya panel untuk Operasional; pengaduan penghuni sampai ke Operasional lewat Admin and Finance (K8).

Cara membaca diagram: kotak = langkah, belah ketupat = keputusan. Nama di awal kotak menunjukkan siapa yang mengerjakan.

| No | Kasus | Aplikasi |
|---|---|---|
| K1 | Siklus status kamar: Kosong, Booking, Terisi, Maintenance | Mini App |
| K2 | Kerusakan dilaporkan: Perbaikan Korektif | Mini App |
| K3 | Perawatan terjadwal: Preventif | Mini App |
| K4 | Inspeksi harian dan temuan | Mini App |
| K5 | Work order: mengirim dan menerima | Mini App |
| K6 | Penghuni baru akan masuk: Pre-Check In | Mini App |
| K7 | Penghuni keluar: Pre-Check Out sampai Kamar Siap Sewa | Mini App |
| K8 | Pengaduan penghuni tentang kerusakan | Teman Rara, Mini App |
| K9 | Menandai kamar Maintenance dengan tombol | Mini App |
| K10 | Pemakaian stok, stok menipis, dan opname | Mini App, Inventory |
| K11 | Vendor dan kecelakaan kerja | Mini App |
| K12 | Evaluasi mingguan KPI Operasional | Dashboard |

---

## K1. Siklus status kamar: Kosong, Booking, Terisi, Maintenance

**Kapan terjadi:** selalu. Memahami siklus ini menjelaskan kenapa sebuah kamar tidak bisa dibooking atau tidak berubah.

Siklus normal (tanpa Maintenance):

```mermaid
flowchart TD
    K["Kosong"] -->|"booking Pending atau Konfirmasi"| B["Booking"]
    B -->|"booking Dibatalkan"| K
    B -->|"Check-in di Daftar Booking, setelah SOP Check-in"| T["Terisi"]
    T -->|"Checkout"| D{"Ada booking berikutnya?"}
    D -->|"ya"| B
    D -->|"tidak"| K
```

Masuk dan keluar Maintenance (dari status mana pun):

```mermaid
flowchart TD
    S["Kamar berstatus Kosong, Booking, atau Terisi"] -->|"salah satu dari empat pemicu Maintenance"| M["Maintenance"]
    M --> R{"Semua pemicu sudah selesai?"}
    R -->|"belum"| M
    R -->|"ya"| H{"Keadaan kamar sekarang"}
    H -->|"ada penghuni aktif"| T["Terisi"]
    H -->|"ada booking, belum check-in"| B["Booking"]
    H -->|"tidak ada keduanya"| K["Kosong"]
```

**Empat pemicu Maintenance** (kamar kembali hanya setelah **semua** pemicunya selesai):

| Pemicu | Memasang | Melepas |
|---|---|---|
| Tombol di menu Status Kamar | Tandai Maintenance, alasan wajib | Selesai Maintenance (menutup semua pemicu kamar itu) |
| Pengaduan Teman Rara (hanya penghuni aktif) | Komplain Listrik, Air, AC, atau Fasilitas diubah ke Diproses | Selesai, Dibatalkan, atau kembali Menunggu |
| Inspeksi checkout (Pre-Check Out) | Ada item Rusak atau Perlu Perbaikan | Kamar Siap Sewa diisi, atau inspeksi dikirim ulang semua Baik |
| Work order tujuan Maintenance | Kolom Kamar diisi | Work order Complete |

**Perhatikan:** kamar Booking dan Maintenance tidak muncul di pilihan booking baru. Checkout tidak mengubah kamar Maintenance menjadi Kosong selama masih ada pemicu terbuka.

---

## K2. Kerusakan dilaporkan: Perbaikan Korektif

**Kapan terjadi:** ada kerusakan yang harus diperbaiki (dari temuan sendiri atau laporan). SLA tiket saat ini 3 hari, Resolution Time paling lama 1 hari.

```mermaid
flowchart TD
    A["Operasional: Perbaikan Korektif<br/>isi tanggal, lokasi, kategori, penyebab, prioritas,<br/>waktu laporan masuk"] --> B["Tiket dibuat, status awal Tertunda atau Proses"]
    B --> C["Ubah status ke Proses<br/>Waktu Mulai Ditindak terisi otomatis"]
    C --> D{"Perlu vendor?"}
    D -->|"ya"| E["Isi vendor, status Menunggu Vendor"]
    D -->|"tidak"| F["Kerjakan sendiri"]
    E --> G["Pekerjaan selesai"]
    F --> G
    G --> H["Isi Tanggal Selesai, biaya, dan lampiran<br/>status Selesai"]
    H --> I{"Biaya lebih dari nol?"}
    I -->|"ya"| J["Work order ke Admin otomatis dibuat,<br/>Admin mencatat pengeluaran"]
    I -->|"tidak"| K["Selesai"]
    J --> K
```

**Checklist**
- [ ] Tanggal Selesai diisi begitu tuntas. Tiket tanpa tanggal selesai dianggap belum selesai dan tidak masuk Resolution Time.
- [ ] Kasus berulang di lokasi yang sama diberi perbaikan permanen. Tiket Berulang paling banyak 2 kasus.
- [ ] Bila kerusakan membuat kamar tidak layak dipakai, tandai kamar Maintenance (K9 atau lewat work order berkamar, K5).

---

## K3. Perawatan terjadwal: Preventif

**Kapan terjadi:** jadwal servis AC, pompa, listrik, dan fasilitas lain.

```mermaid
flowchart TD
    A["Operasional: Perawatan Preventif<br/>tanggal jadwal, fasilitas, jenis, kategori, pelaksana"] --> B{"Dikerjakan tepat jadwal?"}
    B -->|"ya"| C["Isi tanggal selesai, status Selesai"]
    B -->|"tertunda"| D["Status Tertunda atau Menunggu Vendor,<br/>jadwalkan ulang"]
    C --> E["Kepatuhan Jadwal Preventif terhitung"]
    D --> F["Mingguan: periksa jadwal lewat tapi belum selesai"]
    F --> A
    C --> G{"Biaya lebih dari nol?"}
    G -->|"ya"| H["Work order ke Admin otomatis dibuat"]
    G -->|"tidak"| I["Selesai"]
```

**Perhatikan:** target Kepatuhan Jadwal Preventif 100%.

---

## K4. Inspeksi harian dan temuan

**Kapan terjadi:** setiap hari. Satu inspeksi per hari sudah membuat hari itu dihitung patuh.

```mermaid
flowchart TD
    A["Operasional: isi Inspeksi Kebersihan<br/>atau Inspeksi Fasilitas"] --> B["Isi area, kondisi, tindak lanjut, petugas, foto"]
    B --> C{"Ada temuan masalah?"}
    C -->|"tidak"| D["Hari itu dihitung patuh"]
    C -->|"ya"| E{"Siapa yang menangani?"}
    E -->|"Kebersihan"| F["Input Work Order ke Cleaning"]
    E -->|"Kerusakan"| G["Input Work Order ke Maintenance<br/>isi kolom Kamar bila menyangkut satu kamar"]
    E -->|"Bisa segera ditangani sendiri"| H["Perbaikan Korektif (K2)"]
    F --> I["Muncul di Joblist divisi tujuan"]
    G --> I
    D --> J["Selesai"]
    I --> J
```

**Perhatikan:** target Kepatuhan Inspeksi Harian 100%. Dihitung dari jumlah hari yang punya inspeksi.

---

## K5. Work order: mengirim dan menerima

**Kapan terjadi:** ada pekerjaan yang harus dikerjakan sub-divisi lain (Inspeksi ke Cleaning atau Maintenance, Cleaning ke Maintenance atau Inspeksi), atau Anda menerima pekerjaan di Joblist.

```mermaid
flowchart TD
    A["Pengirim: Input Work Order<br/>lokasi, kategori, deskripsi, prioritas, divisi tujuan,<br/>deadline, foto JPG atau PNG"] --> B{"Tujuan Maintenance<br/>dan kolom Kamar diisi?"}
    B -->|"ya"| C["Kamar otomatis berstatus Maintenance"]
    B -->|"tidak"| D["Status kamar tidak berubah"]
    C --> E["Joblist divisi tujuan: Pending<br/>peringatan kuning di Beranda"]
    D --> E
    E --> F["Penerima: ubah status ke In Progress<br/>PIC terisi nama penerima"]
    F --> G["Pekerjaan selesai"]
    G --> H["Ubah status ke Complete<br/>hilang dari Joblist"]
    H --> I["Pemicu Maintenance work order dilepas.<br/>Kamar kembali bila tidak ada pemicu lain"]
```

**Checklist**
- [ ] Prioritas sesuai: Rendah, Sedang, Tinggi, Darurat.
- [ ] Kolom Kamar kosong untuk area umum (tidak mengubah status kamar).
- [ ] Hanya staf divisi tujuan yang bisa mengubah status. Owner dan Pengawas hanya melihat.

---

## K6. Penghuni baru akan masuk: Pre-Check In

**Kapan terjadi:** booking sudah Konfirmasi dan penghuni akan masuk.

```mermaid
flowchart TD
    A["Admin: booking Konfirmasi"] --> B["Operasional: Pre-Check In Form<br/>periksa kondisi kamar item per item, foto"]
    B --> C{"Ada item Rusak atau Perlu Perbaikan?"}
    C -->|"ya"| D["Perbaiki dulu: Perbaikan Korektif<br/>atau Work Order, lalu periksa ulang"]
    C -->|"tidak"| E["Ajukan, form tidak bisa diubah lagi"]
    D --> B
    E --> F["Admin atau Owner: Approval Check-in"]
    F --> G{"Disetujui?"}
    G -->|"ya"| H["Tombol Check-in di Daftar Booking aktif"]
    G -->|"tidak"| I["Ditolak: ajukan ulang setelah diperbaiki"]
    I --> B
    H --> J["Admin: Check-in, kamar Terisi.<br/>Kondisi awal tersimpan untuk Pre-Check Out nanti"]
```

**Perhatikan:** form tidak bisa diubah setelah diajukan, jadi periksa teliti sebelum klik. Kondisi awal ini menjadi pembanding saat penghuni keluar.

---

## K7. Penghuni keluar: Pre-Check Out sampai Kamar Siap Sewa

**Kapan terjadi:** penghuni mengajukan checkout dan sudah disetujui Admin and Finance.

```mermaid
flowchart TD
    A["Admin: pengajuan checkout Disetujui.<br/>Operasional: Pre-Check Out Form, bandingkan dengan kondisi awal"] --> C{"Ada item Rusak atau Perlu Perbaikan?"}
    C -->|"ya"| D["Kamar otomatis Maintenance (pemicu inspeksi)"]
    C -->|"tidak"| E["Ajukan"]
    D --> E
    E --> F["Admin atau Owner: Approval Check-out, putuskan deposit.<br/>Admin: form Checkout, penghuni tidak aktif"]
    F --> H{"Ada pemicu Maintenance terbuka?"}
    H -->|"ya"| I["Kamar tetap Maintenance, perbaiki dan bersihkan"]
    H -->|"tidak"| J["Kamar Kosong, atau Booking bila ada booking berikutnya.<br/>Bersihkan kamar"]
    I --> L["Operasional: Kamar Siap Sewa, isi Waktu Kamar Siap"]
    J --> L
    L --> M["Pemicu inspeksi dilepas, kamar Kosong atau Booking"]
```

**Checklist**
- [ ] Waktu Kamar Siap diisi begitu kamar siap. Waktu Prepare Kamar dihitung dari checkout sampai waktu ini (target paling lama 1 hari).
- [ ] Yang muncul di pilihan Kamar Siap hanya checkout yang belum ditandai siap.
- [ ] Temuan kerusakan diteruskan ke Perbaikan Korektif atau Work Order agar ada jejak biayanya.

---

## K8. Pengaduan penghuni tentang kerusakan

**Kapan terjadi:** penghuni aktif mengirim pengaduan Listrik, Air, AC, atau Fasilitas lewat Teman Rara.

```mermaid
flowchart TD
    A["Penghuni aktif: pengaduan di Teman Rara"] --> B["Admin: tinjau, ubah status ke Diproses"]
    B --> C["Kamar penghuni otomatis Maintenance"]
    C --> D["Operasional: terima kabar dari Admin and Finance<br/>atau lihat alasan Maintenance di menu Status Kamar"]
    D --> E["Perbaikan Korektif atau Work Order ke Maintenance<br/>(isi kolom Kamar)"]
    E --> F["Perbaikan selesai"]
    F --> G["Admin: tulis tanggapan, status Selesai"]
    G --> H["Pemicu pengaduan dilepas"]
    H --> I{"Masih ada pemicu lain di kamar itu?"}
    I -->|"ya"| J["Kamar tetap Maintenance"]
    I -->|"tidak"| K["Kamar kembali Terisi"]
```

**Perhatikan:** pengaduan dari penghuni yang sudah tidak aktif tidak mengubah status kamar. Operasional tidak punya panel Teman Rara, jadi koordinasi dengan Admin and Finance penting. Pengaduan non-kerusakan (kebersihan, keamanan, pelayanan) tidak memasang Maintenance.

---

## K9. Menandai kamar Maintenance dengan tombol

**Kapan terjadi:** kamar perlu direnovasi atau dikosongkan untuk pekerjaan yang tidak punya tiket, pengaduan, atau work order.

```mermaid
flowchart TD
    A["Operasional: Mini App, menu Status Kamar"] --> B["Cari kamar"]
    B --> C{"Mau apa?"}
    C -->|"Mulai Maintenance"| D["Klik Tandai Maintenance, isi alasan wajib"]
    C -->|"Akhiri Maintenance"| E{"Pemicu otomatisnya sudah selesai?"}
    D --> F["Kamar Maintenance,<br/>tidak muncul di pilihan booking"]
    E -->|"ya"| G["Klik Selesai Maintenance<br/>(menutup semua pemicu kamar itu)"]
    E -->|"belum"| H["Selesaikan dulu pemicunya:<br/>work order, pengaduan, inspeksi"]
    G --> I["Kamar kembali Terisi, Booking, atau Kosong<br/>sesuai keadaan"]
    H --> E
```

**Perhatikan:** tombol Selesai menutup semua pemicu, termasuk yang otomatis. Pakai hanya bila pekerjaannya benar-benar beres. Semua perubahan tercatat (siapa dan kapan).

---

## K10. Pemakaian stok, stok menipis, dan opname

**Kapan terjadi:** setiap kali bahan dipakai.

```mermaid
flowchart TD
    A["Operasional: bahan dipakai<br/>mis. membersihkan atau memperbaiki"] --> B{"Cara mencatat (pilih salah satu)"}
    B -->|"Mini App"| C["Pemakaian Stok Maintenance atau Cleaning:<br/>bahan, jumlah, catatan lokasi"]
    B -->|"Inventory"| D["Inventory, Pemakaian: bahan, batch asal,<br/>jumlah, catatan"]
    C --> E["Stok berkurang di Inventory"]
    D --> E
    E --> F{"Stok di bawah atau sama dengan batas minimum?"}
    F -->|"ya"| G["Muncul di Stok Menipis:<br/>sampaikan ke Admin and Finance untuk belanja"]
    F -->|"tidak"| H["Selesai"]
    G --> I["Admin: Pembelian di Inventory, stok bertambah"]
    I --> H
    H --> J["Akhir bulan: bantu hitung fisik<br/>untuk Laporan Opname Owner"]
```

**Perhatikan:** jangan mencatat pemakaian yang sama di kedua tempat. Pemakaian tanpa batch dicatat tanpa biaya.

---

## K11. Vendor dan kecelakaan kerja

**Kapan terjadi:** butuh vendor baru, atau terjadi kecelakaan saat bekerja.

```mermaid
flowchart TD
    A["Operasional"] --> B{"Keperluan"}
    B -->|"Vendor baru"| C["Tambah Vendor: nama, kategori,<br/>nomor telepon, catatan penilaian"]
    B -->|"Kecelakaan kerja"| D["Kecelakaan Kerja: tanggal, lokasi, petugas,<br/>kronologi, tindakan"]
    C --> E["Vendor muncul di Daftar Vendor<br/>dan bisa dipilih di tiket"]
    D --> F["Masuk logbook dan laporan Kinerja Admin"]
```

---

## K12. Evaluasi mingguan KPI Operasional

**Kapan terjadi:** tiap minggu dan awal bulan.

```mermaid
flowchart TD
    A["Operasional: Dashboard Operasional"] --> B["Baca kartu: Tiket, Defect Rate, SLA,<br/>Resolution Time, Kepatuhan, Waktu Prepare Kamar"]
    B --> C{"KPI di bawah target?"}
    C -->|"SLA atau Resolution Time"| D["Perbarui status tiket, isi tanggal selesai"]
    C -->|"Kepatuhan inspeksi atau preventif"| E["Isi inspeksi harian, kejar jadwal terlewat"]
    C -->|"Tiket Berulang"| F["Rencanakan perbaikan permanen"]
    C -->|"Waktu Prepare Kamar"| G["Isi Kamar Siap Sewa tepat waktu"]
    C -->|"semua tercapai"| H["Pertahankan"]
    D --> I["Awal bulan: baca Kinerja Operasional dari email"]
    E --> I
    F --> I
    G --> I
    H --> I
```

---

## Ringkasan: kasus, KPI, dan target

| Kasus | KPI | Target |
|---|---|---|
| K2 | Kepatuhan SLA tiket | 100% (SLA saat ini 3 hari) |
| K2 | Resolution time | Paling lama 1 hari |
| K2, K12 | Tiket berulang | Paling banyak 2 kasus |
| K2, K3 | Biaya perbaikan per kamar | Paling tinggi Rp150.000 |
| K3 | Kepatuhan jadwal preventif | 100% |
| K4 | Kepatuhan inspeksi harian | 100% |
| K7 | Waktu prepare kamar | Paling lama 1 hari |
