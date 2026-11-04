# Rancangan: Generate Laporan Otomatis dari Database + Template

Status: **DRAFT, keputusan inti sudah dijawab (bagian 9), menunggu persetujuan akhir dokumen ini.** Belum ada kode yang ditulis.
Tanggal: 2 November 2026 · Properti: A (Kost Tiga Dara Putri UGM)

## 1. Tujuan

Laporan bulanan yang sekarang ada di Google Drive (57 file Google Docs) dihasilkan otomatis dari Turso, dengan tampilan dan susunan **sama persis** dengan contoh di Drive. Staf tidak lagi menyusun laporan manual.

Bukan tujuan: mengubah isi/format laporan, membuat laporan Properti B, mengganti modul laporan keuangan formal (Laba Rugi, Arus Kas, Neraca) yang sudah ada di `src/lib/laporan`.

## 2. Hasil membaca Drive

Tiga folder, 57 Google Doc, semuanya berukuran kecil (0,6 sampai 8 KB teks). Periode Mei sampai Oktober 2026. Banyak file Juni ada 2 sampai 3 versi (tanda template diperbaiki bertahap). Folder `Kebersihan` di folder 2 kosong.

| Folder | Isi | Jumlah | Template |
|---|---|---|---|
| 1. Laporan Kerja Divisi | Admin, Finance, Marketing, operasional, Sales | 22 | berbasis daftar tugas (logbook) |
| 2. Laporan Kinerja | Admin, Keuangan, Marketing, Operasional, Sales | 28 | berbasis metrik dari data |
| 3. Owner Review | satu laporan gabungan untuk pemilik | 7 | ringkasan eksekutif 6 bagian |

Dari sini ada **3 keluarga laporan, 11 template**:

### Keluarga A: Laporan Pekerjaan Bulanan (folder 1, divisi Admin/Keuangan/Marketing/Sales)
Satu tata letak untuk empat divisi, hanya nama divisi dan nama staf yang beda.
- Judul: `LAPORAN PEKERJAAN BULANAN` / `DIVISI {X} — KOST TIGA DARA` / `Periode: {Bulan Tahun}` / `Tanggal dibuat: dd/mm/yyyy`
- A. RINGKASAN: tabel Indikator|Jumlah (Total Pekerjaan, Selesai, Proses, Tertunda, Persentase Selesai)
- B. RINCIAN PEKERJAAN: kolom No, Tanggal, Pekerjaan, Bidang, PIC, Deadline, Status. Bila kosong: satu baris `(tidak ada data pada periode ini)`
- C. CATATAN / KENDALA: dua baris titik-titik untuk diisi tangan
- Tanda tangan: `Dibuat oleh, Staf {DIVISI}` dan `Disetujui oleh, Pengelola`

### Keluarga B: Laporan Kerja Operasional dan Laporan Kinerja per divisi
- **Operasional (folder 1)** ada dua gaya. Gaya "hitung tugas" (dipakai Juli sampai Oktober, tampak hasil generator): Ringkasan Eksekutif per sub-divisi (Maintenance, Inspeksi, Kebersihan) dengan kolom Total Task/Complete/In Progress/Pending/Lewat Deadline, lalu bagian A, B, C per sub-divisi. Gaya "kaya" (satu file Juni, tampak disunting manual): ringkasan naratif, tabel perawatan preventif dan perbaikan korektif berbiaya, rekap pengeluaran, catatan dan rekomendasi.
- **Kinerja (folder 2)**, header `LAPORAN KINERJA {DIVISI}` / `Kost Tiga Dara Putri UGM` / `Periode | Dibuat: dd/mm/yyyy hh:mm`:
  - Admin: A Feedback Penghuni, B Pelanggaran Peraturan, C Logbook Kecelakaan Kerja, lalu Lampiran 1 sampai 3 (detail logbook)
  - Keuangan: A Arus Kas, B Laba/Rugi, C Pengeluaran per Kategori, D Rincian Transaksi (Tgl, Debit, Kredit, Nominal, Keterangan)
  - Marketing: A Akuisisi Leads, B Kinerja Konten Sosmed, C Kinerja Kampanye/Promosi
  - Operasional (Inspeksi & Maintenance): A Inspeksi Harian, B Perawatan Preventif, C Perbaikan Korektif, D Total Pengeluaran
  - Sales: A Aktivitas Booking (+ tabel Tgl, Nama, Kamar, Status, Harga, Sumber), B Aktivitas Survey/Leads
  - Tanda tangan: `Dibuat oleh, Staf Divisi` dan `Mengetahui, Pengelola Kost`

### Keluarga C: Owner Review Bulanan (folder 3)
Header `KOST TIGA DARA PUTRI UGM` / `Laporan Owner Review Bulanan` / `Periode` / `Dibuat otomatis {tanggal} · Sumber: ...`. Enam bagian: 1 Ringkasan Eksekutif (bullet), 2 Hunian & Penyewa (penghuni baru, penghuni keluar), 3 Keuangan (indikator + rincian transaksi), 4 Operasional (indikator + rincian pekerjaan), 5 Marketing, 6 Kualitas Data & Rekomendasi. Footer: `Laporan otomatis · ... · Hanya memuat data dalam periode laporan.`

### Gaya visual (diambil dari ekspor HTML Drive)
- Divisi dan Kinerja: Arial 11 pt, judul 20 sampai 26 pt, tabel border hitam 1 pt, sel header berlatar biru muda `#d9e2f3` (Keluarga A), margin 72 pt (1 inci), nama kertas A4 diasumsikan.
- Owner Review: font judul Poppins, isi Lato, palet merah `#9e2227` / `#c92d31`, latar `#f8e9e9`, border `#e3d9d7`, teks `#33302f`, margin 54 pt.
- Operasional gaya kaya: Arial + Georgia, header tabel `#efefef`, border `#888888`.
- Detail pixel per template diverifikasi saat membangun, dengan membandingkan render PDF terhadap tangkapan layar dokumen Drive.

## 3. Temuan yang memengaruhi rancangan

1. **Kolom "Tanggal Keluar" yang dikeluhkan Owner Review sudah ada di database**: `checkout_log.tanggal_checkout`. Bagian "Penghuni Keluar" bisa terisi otomatis, tidak perlu lagi catatan "data belum tersedia".
2. **Bagian "Kualitas Data & Rekomendasi" saat ini teks tetap** yang sama persis tiap bulan. Dengan database, rekomendasi bisa dihitung (mis. "tidak ada inspeksi tercatat bulan ini").
3. **Tabel Pelanggaran Peraturan dan Kecelakaan Kerja tidak ada** di skema (`db/schema`). Laporan Kinerja Admin membutuhkannya. Perlu dibuat tabel baru, atau bagian ini tampil kosong dulu.
4. **Cacat di contoh Drive yang tidak boleh ikut terbawa**: typo "Kamaar 29" (data sumber), baris sewa Jessica terhitung 4 kali di Agustus dan September (kemungkinan transaksi ganda), versi Juni Owner Review yang angkanya salah karena tertarik data setengah jadi (Rp1.675.000 vs Rp11.825.000), status campur Inggris/Indonesia (`Complete` vs `Selesai`), Total Kamar 29 vs 30.
5. **Infrastruktur sudah ada**: `htmlKePdf` (puppeteer, dipakai invoice dan laporan keuangan), `googleapis` (Drive), tabel `laporan_riwayat`, pola route `api/ops/admin/laporan-keuangan`, peran `owner`/`staff_admin`/`staff_sales`. Tidak ada dependensi baru yang diperlukan.
6. **Privasi**: laporan Keuangan dan Owner memuat nama penghuni. Dokumen referensi di repo hanya boleh berisi struktur, bukan data nyata (mengikuti keputusan di `docs/golden-report.md`).

## 4. Arsitektur yang diusulkan

```
Turso ──► data builder (query per laporan) ──► objek JSON bertipe
                                                    │
                       template HTML (satu fungsi per template, gaya CSS bersama)
                                                    │
                  ┌─────────────────────────────────┴───────────┐
          htmlKePdf (PDF)                          pratinjau di web (iframe)
                  │
        arsip ke Drive (folder per divisi/keluarga) + catat di laporan_riwayat
```

Prinsip: **data builder** dan **template** dipisah. Template tidak pernah query database; builder tidak tahu HTML. Dengan begitu satu data bisa dirender ulang jika template berubah, dan template mudah diuji dengan data contoh.

Struktur kode (mengikuti `src/lib/laporan` yang ada):
```
src/lib/laporan-bulanan/
  types.ts            tipe data tiap laporan
  periode.ts          bulan -> rentang tanggal, label "Oktober 2026", format tanggal id-ID
  styles.ts           CSS bersama (Arial/tabel) + tema Owner
  builders/           pekerjaan.ts, operasional.ts, kinerja-*.ts, owner.ts
  templates/          satu file per template
  registry.ts         daftar laporan: id, judul, builder, template, folder Drive, nama file
```
API: `GET /api/ops/admin/laporan-bulanan?jenis=&periode=` (pratinjau/PDF) dan `POST` (generate dan arsipkan). Halaman: tab baru di panel laporan yang sudah ada. Perluasan `laporan_riwayat.jenis` dari 3 nilai tetap ke daftar baru memerlukan migrasi `018_*.sql`, karena kolom itu memakai CHECK.

## 5. Pemetaan data (perlu diverifikasi terhadap data produksi saat membangun)

| Laporan | Sumber tabel |
|---|---|
| Pekerjaan (Admin/Keuangan/Marketing/Sales) | `logbook_divisi` atau `daily_tasks` (kolom identik: tanggal, task, pic, divisi, deadline, status). **Perlu dicek mana yang dipakai staf.** |
| Operasional | `logbook_divisi` (Kebersihan), `inspeksi_fasilitas`, `inspeksi_kebersihan`, `maintenance_pm`, `maintenance_cm` |
| Kinerja Admin | `feedback`, `tenant_complain`; pelanggaran dan kecelakaan kerja: **tabel belum ada** |
| Kinerja Keuangan | `jurnal_transaksi` + `coa` (memakai fungsi di `src/lib/laporan/generator.ts`, supaya angka sama dengan Laba Rugi dan Arus Kas) |
| Kinerja Marketing | `leads`, `content`, `promotion` |
| Kinerja Sales | `booking`, `survey`, `kamar` |
| Owner Review | `occupancy_history`, `checkout_log`, `booking`, gabungan builder di atas |

## 6. Aturan perhitungan yang harus dipastikan sama

- "Persentase Selesai" = Selesai / Total, dibulatkan ke bilangan bulat (contoh 1 dari 3 = 33%).
- "Lewat Deadline" = status bukan selesai dan deadline lebih awal dari tanggal pembuatan laporan.
- Rentang periode mengikuti tanggal kegiatan, bukan tanggal input.
- "Pendapatan diakui" vs "Kas masuk" mengikuti definisi yang sudah ada di `generator.ts` (basis pengakuan vs kas).
- Format: `Rp1.234.000`, tanggal `dd/mm/yyyy`, bulan nama Indonesia penuh.
- Satu nilai status dalam bahasa Indonesia (Selesai / Proses / Tertunda), bukan campuran.

## 7. Pengujian

- **Uji paritas**: render laporan Juni 2026 dari Turso, bandingkan teks dan struktur dengan dokumen Drive (hasil ekspor `txt`), kecuali cacat di bagian 3.4 yang sengaja dikoreksi.
- **Uji kosong**: bulan tanpa data (Oktober) harus menghasilkan dokumen berstruktur penuh dengan pesan "tidak ada data", seperti contoh Drive.
- **Uji visual**: PDF vs tangkapan Drive, per template.
- Data uji memakai data samaran, bukan data penghuni nyata.

## 8. Tahapan rilis (MVP bertahap)

1. **Fondasi + Keluarga A** (4 divisi): periode, gaya bersama, builder logbook, PDF, tombol di panel. Paling sederhana dan satu tata letak untuk empat laporan.
2. **Owner Review**: paling bernilai bagi pemilik, memakai builder yang sudah ada dan menutup celah Penghuni Keluar.
3. **Kinerja Keuangan, Sales, Marketing, Operasional**.
4. **Kinerja Admin** (menunggu keputusan tabel pelanggaran dan kecelakaan kerja).
5. **Otomatisasi terjadwal** (dibuat tanggal 1 tiap bulan) dan pengarsipan ke Drive.

## 9. Keputusan (dijawab 2 November 2026)

1. **Format keluaran: PDF saja.** Memakai `htmlKePdf`; arsip ke Drive.
2. **Pemicu: tombol, jadwal otomatis tanggal 1, dan pilihan periode tertentu.** Tombol Generate punya pemilih bulan/tahun sehingga laporan bulan lampau bisa dibuat ulang. Jadwal otomatis membuat laporan bulan sebelumnya setiap tanggal 1 (cron).
3. **Operasional:** laporan **kerja** divisi (folder 1) memakai **gaya hitung tugas**; laporan **kinerja** divisi (folder 2) memakai **gaya kaya**.
   - Tafsiran saya (mohon dikoreksi bila salah): "gaya kaya" untuk Kinerja Operasional = susunan folder 2 yang memang sudah kaya (Inspeksi Harian, Perawatan Preventif, Perbaikan Korektif, Total Pengeluaran). Elemen naratif dari file Juni folder 1 (ringkasan naratif, rekap pengeluaran, catatan dan rekomendasi) **tidak** ikut, kecuali Anda minta.
4. **Pelanggaran Peraturan dan Kecelakaan Kerja: buat tabel + form input sekarang.** Ini fitur tersendiri (migrasi, form, hak akses), dikerjakan sebagai tahap sendiri dan butuh desain kecil sendiri (kolom, siapa yang menginput) sebelum dikode.
5. Urutan rilis di bagian 8 dianggap disetujui, dengan penyesuaian di bagian 10.

## 10. Penyesuaian setelah keputusan

- Pemilih periode masuk sejak tahap 1 (bukan tahap akhir), karena hanya selisih satu parameter `periode` yang sudah ada di API.
- Tahap 4 (Kinerja Admin) kini mencakup: migrasi tabel `pelanggaran_peraturan` dan `kecelakaan_kerja`, form input, lalu laporan. Kolom persisnya ditentukan lewat desain kecil terpisah.
- Cron tanggal 1 memerlukan penanda "sudah dibuat" per laporan dan periode (hindari ganda): cukup cek `laporan_riwayat` sebelum membuat. Mekanisme cron mengikuti hosting yang dipakai (Vercel cron bila di Vercel); perlu dipastikan.
- Arsip Drive: struktur folder meniru yang ada (per keluarga, lalu per divisi). ID folder disimpan di `app_config`, bukan di kode.
- Hak akses: tetap memakai peran yang sudah ada (`owner`, `staff_admin`, `staff_sales`); Owner Review dibatasi ke `owner`. Perlu dikonfirmasi bila staf divisi lain juga harus bisa generate laporan divisinya sendiri.
