# Diagram Alir Kasus Operasional: Pengawas

Peran: membaca semua halaman Dashboard seperti Owner untuk memeriksa apakah divisi mengisi data dan apakah angka masuk akal. Pengawas **tidak punya akses Mini App dan Inventory**, tidak mengisi data, dan tidak punya menu Laporan.

Aplikasi yang dipakai: **Dashboard** (baca saja, data pribadi penghuni tampil utuh). Teman Rara, Mini App, dan Inventory tidak bisa dibuka; hasilnya dilihat dari angka di Dashboard.

Cara membaca diagram: kotak = langkah, belah ketupat = keputusan. Temuan Pengawas selalu berakhir sebagai pesan ke divisi terkait atau Owner.

| No | Kasus | Aplikasi |
|---|---|---|
| K1 | Pemeriksaan rutin: kartu strip atau angka tidak bergerak | Dashboard |
| K2 | Tiket maintenance tanpa tanggal selesai | Dashboard |
| K3 | Leads tanpa waktu chat pertama | Dashboard |
| K4 | Dokumen penghuni belum lengkap | Dashboard |
| K5 | Jatuh tempo dan tunggakan tidak ditagih | Dashboard |
| K6 | Menerima laporan bulanan lewat email | Email |

---

## K1. Pemeriksaan rutin: kartu strip atau angka tidak bergerak

**Kapan terjadi:** pemeriksaan mingguan, atau saat satu kartu terasa aneh.

```mermaid
flowchart TD
    A["Pengawas: buka halaman divisi di Dashboard<br/>pilih periode"] --> B{"Kartu menampilkan strip<br/>padahal seharusnya ada data?"}
    B -->|"ya"| C["Form terkait belum diisi pada periode itu"]
    B -->|"tidak"| D{"Angka sama selama<br/>berhari-hari?"}
    D -->|"ya"| E["Divisi berhenti mengisi data"]
    D -->|"tidak"| F["Cek periode dan tombol muat ulang"]
    C --> G["Sampaikan ke divisi terkait:<br/>form mana yang belum diisi"]
    E --> G
    F --> H{"Angka sudah wajar?"}
    H -->|"ya"| I["Selesai"]
    H -->|"tidak"| G
    G --> J{"Divisi menanggapi dan memperbaiki?"}
    J -->|"ya"| I
    J -->|"tidak"| K["Eskalasi ke Owner"]
```

**Checklist**
- [ ] Strip dibaca sebagai "belum ada data", bukan nol.
- [ ] Periode yang dipilih sudah benar sebelum menuduh divisi.
- [ ] Temuan disebutkan spesifik (kartu mana, periode mana).

---

## K2. Tiket maintenance tanpa tanggal selesai

**Kapan terjadi:** Daftar Tiket berisi tiket lama yang tidak pernah selesai.

```mermaid
flowchart TD
    A["Pengawas: Dashboard, Daftar Tiket"] --> B["Urutkan: cari tiket lama<br/>tanpa tanggal selesai"]
    B --> C{"Ada tiket tertunda lama?"}
    C -->|"tidak"| D["Selesai"]
    C -->|"ya"| E["Sampaikan ke Operasional:<br/>perbarui status dan isi tanggal selesai"]
    E --> F{"Pekerjaan memang belum selesai?"}
    F -->|"ya"| G["Minta alasan: menunggu vendor atau tertunda<br/>dan perkiraan selesai"]
    F -->|"tidak, sudah selesai"| H["Operasional isi tanggal selesai<br/>lewat Edit"]
    G --> I["Pantau di pemeriksaan berikutnya"]
    H --> I
```

**Perhatikan:** tiket tanpa tanggal selesai dianggap belum selesai dan tidak masuk hitungan Resolution Time. SLA tiket saat ini 3 hari.

---

## K3. Leads tanpa waktu chat pertama

**Kapan terjadi:** kartu Respons Leads Pertama kosong atau jelek.

```mermaid
flowchart TD
    A["Pengawas: Dashboard, Daftar Leads"] --> B{"Banyak leads tanpa<br/>waktu chat pertama?"}
    B -->|"tidak"| C["Selesai"]
    B -->|"ya"| D["Waktu respons tidak tercatat,<br/>jadi Respons Leads Pertama tidak terhitung"]
    D --> E["Sampaikan ke Marketing:<br/>isi Waktu Chat Pertama lewat Edit"]
    E --> F{"Respons di atas 15 menit?"}
    F -->|"ya"| G["Catat sebagai temuan kinerja<br/>untuk Owner dan Sales"]
    F -->|"tidak"| C
```

---

## K4. Dokumen penghuni belum lengkap

**Kapan terjadi:** kartu Dokumen Penghuni Lengkap di bawah 100%.

```mermaid
flowchart TD
    A["Pengawas: Dashboard Admin and Finance"] --> B{"Dokumen Penghuni Lengkap<br/>di bawah 100%?"}
    B -->|"tidak"| C["Selesai"]
    B -->|"ya"| D["Buka Daftar Penghuni:<br/>cari yang KTP atau Surat Kontrak belum terunggah"]
    D --> E["Sampaikan daftar penghuni<br/>ke Admin and Finance"]
    E --> F["Admin and Finance lengkapi dokumen<br/>lewat Ubah Data Penghuni"]
    F --> G["Periksa ulang pekan depan"]
```

---

## K5. Jatuh tempo dan tunggakan tidak ditagih

**Kapan terjadi:** Daftar Jatuh Tempo berisi penghuni yang belum bayar.

```mermaid
flowchart TD
    A["Pengawas: Dashboard Admin and Finance"] --> B["Lihat Daftar Jatuh Tempo<br/>dan Aging Tunggakan"]
    B --> C{"Ada penghuni menunggak lama?"}
    C -->|"tidak"| D["Selesai"]
    C -->|"ya"| E["Tanyakan ke Admin and Finance:<br/>apakah sudah ditagih"]
    E --> F{"Sudah ditagih?"}
    F -->|"ya"| G["Catat tanggal tagih dan janji bayar,<br/>pantau minggu depan"]
    F -->|"belum"| H["Minta penagihan segera,<br/>laporkan ke Owner bila berulang"]
```

**Perhatikan:** target penghuni menunggak paling banyak 2 dan Collection Rate 100%. Nominal tunggakan adalah perkiraan dari satu tagihan bulanan terakhir.

---

## K6. Menerima laporan bulanan lewat email

**Kapan terjadi:** awal bulan, bila alamat email Pengawas sudah dimasukkan Owner ke daftar penerima.

```mermaid
flowchart TD
    A["Sistem membuat laporan tanggal 1 sampai 3"] --> B{"Alamat email Pengawas<br/>ada di daftar penerima?"}
    B -->|"tidak"| C["Minta Owner menambahkan alamat"]
    B -->|"ya"| D["Email PDF 14 laporan diterima"]
    D --> E["Baca scorecard Indikator Kinerja:<br/>tercapai, belum tercapai, strip"]
    E --> F["Bandingkan dengan temuan Dashboard"]
    F --> G["Sampaikan catatan ke Owner"]
```

**Perhatikan:** Pengawas tidak punya menu Laporan di aplikasi, hanya menerima lewat email.

---

## Ringkasan: tanda, artinya, dan siapa dihubungi

| Tanda di Dashboard | Kemungkinan artinya | Dihubungi |
|---|---|---|
| Kartu strip padahal seharusnya ada data | Form belum diisi | Divisi terkait |
| Angka tidak bergerak berhari-hari | Divisi berhenti mengisi | Divisi terkait, lalu Owner |
| Tiket tanpa tanggal selesai lama | Status tiket tidak diperbarui | Operasional |
| Leads tanpa waktu chat pertama | Waktu respons tidak dicatat | Marketing |
| Dokumen Penghuni Lengkap di bawah 100% | KTP atau Surat Kontrak belum terunggah | Admin and Finance |
| Daftar Jatuh Tempo berisi yang belum bayar | Penagihan belum jalan | Admin and Finance |
