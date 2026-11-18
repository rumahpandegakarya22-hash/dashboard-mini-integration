# Diagram Alir Kasus Operasional: Marketing

Peran: menciptakan leads dengan biaya terkendali. Tugas Marketing berhenti di leads. Survey dan seterusnya dihitung di Sales.

Aplikasi yang dipakai: **Mini App** (Log Leads Harian, Log Konten, Log Promosi, Tugas Harian, Setting Landing Page), **Dashboard** (Overview, Daftar Leads, Konten, Promosi, Dokumen, Target KPI). **Teman Rara**, **Inventory**, dan menu Laporan tidak dipakai Marketing; laporan sampai lewat email bulanan.

Cara membaca diagram: kotak = langkah, belah ketupat = keputusan. Nama di awal kotak menunjukkan siapa yang mengerjakan.

| No | Kasus | Aplikasi |
|---|---|---|
| K1 | Leads baru masuk | Mini App |
| K2 | Mempublikasikan konten | Mini App |
| K3 | Menjalankan promosi atau iklan | Mini App |
| K4 | Mengubah isi landing page | Mini App, Landing page |
| K5 | Evaluasi mingguan: leads kurang atau biaya mahal | Dashboard |
| K6 | Menindaklanjuti Daftar Follow Up | Dashboard, Mini App |
| K7 | Kesalahan input dan laporan bulanan | Mini App, Email |

---

## K1. Leads baru masuk

**Kapan terjadi:** calon penghuni menghubungi lewat WhatsApp, Instagram, iklan, atau situs. Target respons pertama paling lama 15 menit (dihitung dari waktu masuk).

```mermaid
flowchart TD
    A["Calon penghuni menghubungi"] --> B["Marketing: Log Leads Harian<br/>isi waktu leads benar-benar masuk"]
    B --> C["Isi sumber, kebutuhan, dan status Baru"]
    C --> D["Balas chat pertama secepatnya"]
    D --> E["Edit: isi Waktu Chat Pertama Dikirim"]
    E --> F{"Respons di bawah 15 menit?"}
    F -->|"ya"| G["Respons Leads Pertama terhitung baik"]
    F -->|"tidak"| H["Catat penyebab, perbaiki jam siaga"]
    G --> I["Serahkan ke Sales untuk survey"]
    H --> I
    I --> J["Perbarui status leads:<br/>Follow-up, Survey, Negosiasi, Booking, Tidak Jadi, Tidak Respons"]
```

**Checklist**
- [ ] Waktu masuk adalah waktu leads benar-benar masuk, bukan waktu mencatat.
- [ ] Waktu Chat Pertama boleh dikosongkan dulu, tapi harus diisi lewat Edit setelah chat terkirim.
- [ ] Tanpa dua waktu ini, Respons Leads Pertama tidak terhitung (tampil strip).

---

## K2. Mempublikasikan konten

**Kapan terjadi:** setiap konten yang tayang. Target konsistensi posting 100%.

```mermaid
flowchart TD
    A["Marketing: konten tayang"] --> B["Log Konten: tanggal, platform, tipe,<br/>judul atau caption, link, jam tayang, status"]
    B --> C["Isi biaya produksi<br/>fotografer, editor, properti"]
    C --> D["Konten tersimpan"]
    D --> E["Beberapa hari kemudian:<br/>Edit, isi like, komentar, share, reach"]
    E --> F["Engagement Rate dan Funnel Konten<br/>(View, Action, Leads) terhitung"]
    C --> G["Biaya produksi menjadi bagian CAC"]
```

**Perhatikan:** CAC bergantung pada biaya produksi konten, jadi jangan dikosongkan.

---

## K3. Menjalankan promosi atau iklan

**Kapan terjadi:** kampanye berbayar atau promo.

```mermaid
flowchart TD
    A["Marketing: rencanakan promosi"] --> B["Log Promosi: nama, platform,<br/>tanggal mulai dan selesai, budget, target leads, status"]
    B --> C["Promosi berjalan"]
    C --> D["Mingguan: Edit, isi spend aktual<br/>dan leads aktual"]
    D --> E{"Ada booking dari promo?"}
    E -->|"ya"| F["Isi booking dari promo<br/>(koordinasi dengan Sales)"]
    E -->|"tidak"| G["Evaluasi: lanjutkan atau hentikan"]
    F --> H["CPL, ROI Promosi, dan<br/>Pencapaian Target Leads terhitung"]
    G --> H
```

**Perhatikan:** target CPL paling tinggi Rp25.000, CAC paling tinggi Rp50.000, ROI promosi 100%.

---

## K4. Mengubah isi landing page

**Kapan terjadi:** foto kamar, teks, promo di situs publik perlu diubah.

```mermaid
flowchart TD
    A["Marketing: Mini App atau Dashboard,<br/>klik Setting Landing Page"] --> B["Admin landing page terbuka di tab baru<br/>masuk otomatis lewat tiket SSO"]
    B --> C{"Diminta password?"}
    C -->|"ya"| D["Tiket 60 detik habis atau membuka<br/>alamat admin langsung: klik ulang tautan dari aplikasi"]
    C -->|"tidak"| E["Ubah isi, simpan"]
    D --> A
    E --> F["Perubahan tampil di situs publik"]
```

**Perhatikan:** klik tautan hanya saat siap masuk, karena tiketnya berlaku 60 detik. Hanya Owner dan Marketing yang punya tautan ini.

---

## K5. Evaluasi mingguan: leads kurang atau biaya mahal

**Kapan terjadi:** tiap minggu.

```mermaid
flowchart TD
    A["Marketing: Dashboard Marketing"] --> B["Baca Leads Masuk, Pencapaian Target Leads,<br/>CPL, CAC, ROI, Engagement, Konsistensi Posting"]
    B --> C{"Leads kurang dari 10 per minggu?"}
    C -->|"ya"| D["Tambah konten atau promosi,<br/>cek Leads Channel mana yang kuat"]
    C -->|"tidak"| E{"CPL atau CAC di atas target?"}
    E -->|"ya"| F["Hentikan promosi yang boros,<br/>pindahkan budget ke channel terbaik"]
    E -->|"tidak"| G{"Konsistensi posting di bawah 100%?"}
    G -->|"ya"| H["Rapikan jadwal konten"]
    G -->|"tidak"| I["Pertahankan"]
    D --> J["Perbarui like, reach, spend, leads di log"]
    F --> J
    H --> J
    I --> J
```

---

## K6. Menindaklanjuti Daftar Follow Up

**Kapan terjadi:** Dashboard menampilkan Daftar Follow Up.

```mermaid
flowchart TD
    A["Marketing: Dashboard, Daftar Follow Up"] --> B["Pilih leads yang perlu ditindak"]
    B --> C["Hubungi, lalu Edit di Log Leads:<br/>perbarui status dan tindak lanjut"]
    C --> D{"Leads siap survey?"}
    D -->|"ya"| E["Serahkan ke Sales, status Survey"]
    D -->|"tidak"| F["Jadwalkan follow-up berikutnya<br/>atau status Tidak Respons"]
```

---

## K7. Kesalahan input dan laporan bulanan

**Kapan terjadi:** salah isi form, atau awal bulan saat laporan terbit.

```mermaid
flowchart TD
    A["Marketing: sadar ada salah input"] --> B["Cari entri di panel daftar di bawah form"]
    B --> C{"Ada tombol Edit?"}
    C -->|"ya"| D["Edit lalu simpan: data lama ditimpa"]
    C -->|"tidak"| E["Hubungi Owner atau Admin and Finance<br/>jangan buat entri ganda"]
    D --> F["Awal bulan: email PDF laporan diterima<br/>Pekerjaan dan Kinerja Marketing"]
    E --> F
    F --> G["Baca Kinerja Marketing:<br/>akuisisi leads, konten, promosi"]
```

---

## Ringkasan: kasus, KPI, dan target

| Kasus | KPI | Target |
|---|---|---|
| K1 | Leads masuk | Minimal 10 per minggu |
| K1 | Respons leads pertama (Sales ikut) | Paling lama 15 menit |
| K3 | Pencapaian target leads | 80% |
| K3 | CPL | Paling tinggi Rp25.000 |
| K2, K3 | CAC | Paling tinggi Rp50.000 |
| K3 | ROI promosi | 100% |
| K2 | Engagement rate | 70% |
| K2 | Konsistensi posting | 100% |
