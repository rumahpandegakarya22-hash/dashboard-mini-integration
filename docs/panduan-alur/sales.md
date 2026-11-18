# Diagram Alir Kasus Operasional: Sales

Peran: memegang semua urusan setelah leads diserahkan Marketing. Survey, booking, waiting list, dan menjaga penghuni supaya memperpanjang.

Aplikasi yang dipakai: **Mini App** (Log Survey, Tambah Waiting List, Tugas Harian, Riwayat Pembayaran hanya melihat, Laporan), **Dashboard** (Overview, Daftar Prospek, Daftar Penghuni tanpa data pribadi, Data Kamar, Waiting List, Dokumen, Target KPI). **Teman Rara** dan **Inventory** tidak punya menu untuk Sales; hal-hal dari Teman Rara yang memengaruhi Sales dijelaskan di K4 dan K6.

Sales tidak punya form booking. Booking dicatat Admin and Finance.

Cara membaca diagram: kotak = langkah, belah ketupat = keputusan. Nama di awal kotak menunjukkan siapa yang mengerjakan.

| No | Kasus | Aplikasi |
|---|---|---|
| K1 | Leads baru sampai booking | Mini App, Dashboard |
| K2 | Tidak ada kamar kosong: Waiting List | Mini App, Dashboard |
| K3 | Prospek yang belum survey atau belum booking | Dashboard |
| K4 | Calon penghuni mendaftar sendiri lewat Teman Rara | Teman Rara (lewat Admin) |
| K5 | Booking batal | Dashboard |
| K6 | Penghuni bertanya soal pengaduan, bukti bayar, atau akun Teman Rara | Teman Rara (lewat Admin) |
| K7 | Perpanjangan sewa dan Renewal Rate | Dashboard, Mini App |
| K8 | Kamar baru kosong dan antrean Waiting List | Dashboard, Mini App |
| K9 | Evaluasi mingguan dan laporan Kinerja Sales | Dashboard, Mini App |

---

## K1. Leads baru sampai booking

**Kapan terjadi:** Marketing mencatat leads baru. Target respons pertama paling lama 15 menit.

```mermaid
flowchart TD
    A["Marketing: catat leads di Log Leads Harian"] --> B["Sales: hubungi leads lewat chat<br/>target 15 menit sejak leads masuk"]
    B --> C["Marketing: isi Waktu Chat Pertama Dikirim lewat Edit"]
    C --> D{"Leads mau survey?"}
    D -->|"tidak"| E["Status leads Tidak Jadi atau Tidak Respons"]
    D -->|"ya"| F["Sales: jadwalkan dan lakukan survey"]
    F --> G["Sales: Log Survey<br/>tanggal, jam, kamar ditinjau, kesan, keberatan, hasil, follow-up"]
    G --> H{"Hasil survey"}
    H -->|"setuju"| I["Sales: serahkan ke Admin and Finance"]
    H -->|"ragu"| J["Isi tanggal follow-up, masuk Daftar Prospek"]
    H -->|"tidak jadi"| E
    I --> K["Admin: catat booking di Penghuni Baru dan Review"]
    K --> L["Booking tercatat: Konversi Survey ke Booking naik"]
```

**Checklist**
- [ ] Survey dicatat di hari yang sama, lengkap dengan hasil dan tanggal follow-up.
- [ ] Nomor HP calon penghuni benar (satu orang satu baris dicocokkan lewat nomor HP).
- [ ] Booking dari survey cepat dikabarkan ke Admin and Finance, karena angka Booking bergantung padanya.

---

## K2. Tidak ada kamar kosong: Waiting List

**Kapan terjadi:** calon penghuni ingin masuk tapi semua kamar Terisi, Booking, atau Maintenance.

```mermaid
flowchart TD
    A["Sales: calon penghuni minta kamar"] --> B{"Ada kamar tersedia<br/>di Data Kamar?"}
    B -->|"ada"| C["Lanjut survey dan booking (K1)"]
    B -->|"tidak ada"| D["Sales: Tambah Waiting List<br/>nama, WhatsApp, tipe, rencana masuk, budget maksimal"]
    D --> E["Status Menunggu"]
    E --> F["Rencana Masuk disimpan baku YYYY-MM-DD<br/>kolom bisa diurutkan, terdekat dulu"]
    F --> G["Dashboard Waiting List:<br/>pantau antrean, target sekitar 5 orang"]
```

**Perhatikan:** status Waiting List: Menunggu, Dihubungi, Closed. Ubah lewat Edit di panel daftar.

---

## K3. Prospek yang belum survey atau belum booking

**Kapan terjadi:** follow-up mingguan.

```mermaid
flowchart TD
    A["Sales: Dashboard, Daftar Prospek"] --> B["Daftar berisi: leads belum survey<br/>dan sudah survey tapi belum booking"]
    B --> C{"Tahap prospek"}
    C -->|"belum survey"| D["Hubungi dan tawarkan jadwal survey"]
    C -->|"sudah survey belum booking"| E["Follow-up sesuai tanggal follow-up<br/>dan keberatan di Log Survey"]
    D --> F["Catat survey baru di Log Survey"]
    E --> G{"Keputusan"}
    G -->|"booking"| H["Serahkan ke Admin and Finance"]
    G -->|"tidak jadi"| I["Perbarui hasil survey lewat Edit"]
    F --> J["Lihat Funnel Penjualan"]
    H --> J
    I --> J
```

---

## K4. Calon penghuni mendaftar sendiri lewat Teman Rara

**Kapan terjadi:** calon yang sudah kamu survey (atau belum) mengisi form di aplikasi Teman Rara.

```mermaid
flowchart TD
    A["Calon penghuni: isi form pendaftaran di Teman Rara"] --> B["Tercatat sebagai booking Pending"]
    B --> C["Sales: kabari Admin and Finance<br/>supaya cepat ditinjau"]
    C --> D["Admin: Konfirmasi atau Tolak"]
    D --> E{"Hasil review"}
    E -->|"Konfirmasi"| F["Booking Konfirmasi, kamar Booking,<br/>lanjut SOP Check-in oleh Admin dan Operasional"]
    E -->|"Tolak"| G["Booking Dibatalkan,<br/>naik di Cancellation Rate"]
    F --> H["Dihitung sebagai Booking di Dashboard Sales"]
```

**Perhatikan:** Sales tidak bisa membuka panel pendaftaran mandiri. Semua review dilakukan Admin and Finance.

---

## K5. Booking batal

**Kapan terjadi:** calon penghuni membatalkan, atau pendaftaran ditolak.

```mermaid
flowchart TD
    A["Booking menjadi Dibatalkan"] --> B["Kamar kembali Kosong<br/>(kecuali ada booking lain)"]
    B --> C["Naik di Cancellation Rate<br/>target paling tinggi 20%"]
    C --> D["Booking batal kembali menjadi prospek<br/>di Daftar Prospek"]
    D --> E{"Calon masih berminat?"}
    E -->|"ya"| F["Sales: follow-up dan survey ulang"]
    E -->|"tidak"| G["Selesai"]
    B --> H{"Ada antrean Waiting List<br/>untuk tipe kamar ini?"}
    H -->|"ya"| I["Hubungi antrean (lihat K8)"]
    H -->|"tidak"| G
```

---

## K6. Penghuni bertanya soal pengaduan, bukti bayar, atau akun Teman Rara

**Kapan terjadi:** penghuni menghubungi Sales untuk hal yang bukan wewenang Sales.

```mermaid
flowchart TD
    A["Penghuni bertanya ke Sales"] --> B{"Topik"}
    B -->|"Pengaduan atau kerusakan"| C["Arahkan ke Admin and Finance<br/>(target tanggapan 1 jam)"]
    B -->|"Bukti bayar atau invoice"| D["Arahkan ke Admin and Finance<br/>Sales hanya bisa melihat Riwayat Pembayaran"]
    B -->|"Akun Teman Rara bermasalah"| E["Arahkan ke Admin and Finance"]
    B -->|"Perpanjangan atau pindah"| F["Ditangani Sales (K7)"]
    D --> G["Sales boleh cek status invoice:<br/>Lunas, Belum Bayar, Void"]
```

---

## K7. Perpanjangan sewa dan Renewal Rate

**Kapan terjadi:** bulanan, untuk penghuni yang sewanya akan jatuh tempo.

```mermaid
flowchart TD
    A["Sales: Dashboard, Daftar Penghuni atau Overview<br/>cari penghuni mendekati jatuh tempo"] --> B["Ingatkan penghuni memperpanjang<br/>(pengingat Teman Rara berjalan otomatis)"]
    B --> C{"Penghuni memperpanjang?"}
    C -->|"ya"| D["Admin: catat pembayaran sewa"]
    C -->|"tidak"| E["Penghuni ajukan checkout (Admin and Finance)"]
    D --> F["Renewal Rate naik, target 100%"]
    E --> G["Vacancy Days mulai dihitung, target paling lama 30 hari"]
    G --> H["Sales: cari penghuni pengganti dari Waiting List"]
```

**Perhatikan:** invoice yang di-void tidak dihitung sebagai tagihan atau pengingat. Rata-rata lama sewa ditargetkan minimal 3 bulan.

---

## K8. Kamar baru kosong dan antrean Waiting List

**Kapan terjadi:** penghuni checkout atau booking batal membuat kamar tersedia.

```mermaid
flowchart TD
    A["Penghuni checkout atau booking batal"] --> B["Operasional: Kamar Siap Sewa<br/>setelah dibersihkan dan diperbaiki"]
    B --> C["Sales: Dashboard, Data Kamar<br/>cek kamar tersedia"]
    C --> D{"Ada antrean Waiting List<br/>yang cocok tipe dan budget?"}
    D -->|"ya"| E["Hubungi dan ubah status jadi Dihubungi"]
    D -->|"tidak"| F["Tawarkan ke prospek di Daftar Prospek"]
    E --> G{"Setuju?"}
    G -->|"ya"| H["Survey atau langsung serahkan ke Admin untuk booking,<br/>status Waiting List Closed"]
    G -->|"tidak"| I["Tetap Menunggu atau Closed"]
    H --> J["Booking tercatat, kamar Booking"]
```

**Perhatikan:** kamar Maintenance atau Booking tidak muncul sebagai kamar tersedia. Waiting List tidak otomatis memberi tahu Sales, jadi pemeriksaannya manual.

---

## K9. Evaluasi mingguan dan laporan Kinerja Sales

**Kapan terjadi:** tiap minggu dan awal bulan.

```mermaid
flowchart TD
    A["Sales: Dashboard Sales"] --> B["Baca baris KPI dan Funnel Penjualan"]
    B --> C{"KPI di bawah target?"}
    C -->|"Respons leads lambat"| D["Perbaiki: balas leads di bawah 15 menit"]
    C -->|"Konversi survey ke booking rendah"| E["Tinjau keberatan di Log Survey,<br/>perbaiki penawaran"]
    C -->|"Vacancy Days panjang"| F["Aktifkan Waiting List dan prospek"]
    C -->|"semua tercapai"| G["Pertahankan"]
    D --> H["Awal bulan: Laporan, Pekerjaan Sales dan Kinerja Sales"]
    E --> H
    F --> H
    G --> H
```

---

## Ringkasan: kasus, KPI, dan target

| Kasus | KPI | Target |
|---|---|---|
| K1 | Respons leads pertama | Paling lama 15 menit |
| K1 | Konversi Leads ke Survey | 90% |
| K1 | Konversi Survey ke Booking | 90% |
| K1, K4 | Booking baru | Minimal 1 per bulan |
| K2, K8 | Waiting List | Antrean sekitar 5 orang |
| K5 | Cancellation rate | Paling tinggi 20% |
| K7 | Renewal rate | 100% |
| K7 | Rata-rata lama sewa | Minimal 3 bulan |
| K7, K8 | Vacancy days | Paling lama 30 hari |
| K1, K7 | Okupansi | 100% |
