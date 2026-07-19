# Laporan Audit: Sumber Data & Alur Bisnis
**Kost Tiga Dara — Dashboard & Mini App**
Tanggal audit: 18 Juli 2026

---

## 1. Ringkasan Singkat (Baca Ini Dulu)

Ada 2 pertanyaan yang dicek:

1. **Apakah Dashboard dan Mini App sudah 100% pakai database Turso, atau masih ada yang "nyolong" data dari tempat lain?**
2. **Apakah alur kerja (leads → survey → booking → bayar → check-in) di kode sudah sesuai dengan rencana yang digambar di flowchart?**

**Hasil singkatnya:**

| Aplikasi | Status Database | Keterangan |
|---|---|---|
| 🟢 **Dashboard** (D:\Dashboard Figma) | **AMAN** — 100% Turso | Tidak ada sumber data lain. Sudah bersih. |
| 🔴 **Mini App** (miniapp-kost) | **BELUM AMAN** | Masih pakai Google Sheets, Google Apps Script, dan Google Drive sebagai gudang data utama. Turso baru dipakai untuk sebagian kecil fitur. |

Dan untuk alur bisnis: **4 dari 5 aturan penting belum berjalan sesuai rencana** di Mini App (detail di Bagian 3).

---

## 2. Penjelasan Sederhana: Kenapa "Satu Sumber Data" Itu Penting?

Bayangkan Turso itu seperti **satu lemari arsip pusat** yang bisa diakses oleh Dashboard (buat Owner memantau) dan Mini App (buat staff input data harian). Kalau semua aplikasi ambil data dari lemari yang sama, datanya **selalu sinkron** — apa yang dilihat Owner di Dashboard = apa yang diinput staff di Mini App.

Masalahnya, kalau ada aplikasi yang **masih menyimpan sebagian data di tempat lain** (misalnya di Google Sheets), maka bisa terjadi:
- Data di Sheets dan data di Turso **beda sendiri-sendiri**, tidak nyambung.
- Owner lihat di Dashboard "kamar kosong", padahal di Sheets sebenarnya sudah ada booking baru masuk yang belum ke-sync.
- Kalau nanti Sheets-nya diedit manual atau linknya rusak, data bisa hilang tanpa jejak.

### Apa saja yang ditemukan di Mini App selain Turso?

| Sumber Data | Analoginya Apa? | Dipakai Untuk Apa |
|---|---|---|
| **Google Sheets** (13 spreadsheet) | Buku catatan manual terpisah dari lemari arsip pusat | Leads, Survey, **Booking**, daftar harga kamar, data penghuni aktif, checkout, pengeluaran, konten marketing, jadwal maintenance |
| **Google Apps Script** (semacam "robot" di Google) | Petugas fotokopi di gedung sebelah yang harus ditelepon dulu | Membuat & mengirim invoice (tagihan) pembayaran — kalau "petugas" ini gagal/error, sistem tetap lanjut tanpa invoice terkirim (gagal diam-diam) |
| **Google Drive** | Gudang penyimpanan dokumen fisik | Simpan foto KTP, bukti bayar, foto pekerjaan maintenance |

Jadi kalau ditanya **"Apakah Mini App sudah 100% pakai Turso?"** — jawabannya **BELUM**. Modul yang paling penting secara bisnis (leads, survey, booking, harga kamar) **masih di Google Sheets**, bukan Turso.

---

## 3. Cek Alur Bisnis: Sesuai Rencana atau Tidak?

Rencana alurnya seperti ini (disederhanakan):

```
Leads Baru → (opsional) Survey → Booking (bayar DP 50% atau Lunas)
   → status "pending" → dikonfirmasi pembayarannya → status "konfirmasi"
   → saat Check-in → dibuatkan ID Penghuni → data masuk ke tabel Penghuni Aktif
```

Berikut hasil pengecekan tiap aturan, satu per satu, dengan bahasa yang mudah dipahami:

### ❌ Aturan 1: DP harus 50% dari harga kamar resmi
**Yang seharusnya terjadi:** Harga DP dihitung dari kolom harga resmi di tabel kamar (data pusat), supaya tidak bisa dimanipulasi.

**Yang terjadi sekarang:** Perhitungan 50%-nya sudah benar secara matematika, TAPI harga yang dipakai diambil dari **kolom terpisah di Google Sheets** yang diisi manual, bukan dari tabel kamar resmi. Artinya kalau ada orang yang lupa update salah satu sheet, harga DP bisa salah tanpa ketahuan.

**Ibaratnya:** Seperti punya 2 daftar harga menu di restoran — satu di dapur, satu di kasir — dan tidak ada yang mengecek apakah keduanya sama.

### ❌ Aturan 2: Harga kamar tidak boleh dinego
**Yang seharusnya terjadi:** Staff tidak bisa mengubah harga kamar seenaknya saat input booking — harus sama persis dengan harga resmi.

**Yang terjadi sekarang:** Sistem **menerima harga apa saja** yang diketik staff, tanpa dicek ulang. Bahkan petunjuk di formulirnya secara terang-terangan menulis *"bisa disesuaikan jika ada nego"*.

**Ibaratnya:** Kasir toko dikasih kalkulator, tapi bisa ketik harga sesuka hati tanpa dicocokkan ke daftar harga resmi. Ini celah untuk kesalahan input atau kecurangan.

### ❌ Aturan 3: Saat Check-in, harus otomatis buat ID Penghuni + catatan penghuni aktif
**Yang seharusnya terjadi:** Begitu status booking berubah jadi "Check-in", sistem otomatis membuatkan ID Penghuni baru dan mencatatnya sebagai penghuni aktif.

**Yang terjadi sekarang:** **Fitur ini sama sekali belum ada** di Mini App. Tidak ditemukan satupun bagian kode yang melakukan proses ini. Kemungkinan besar proses ini dilakukan manual atau di aplikasi lain (Dashboard), tapi belum terhubung otomatis dari Mini App.

**Ibaratnya:** Tamu sudah check-in di hotel, tapi resepsionis lupa mendaftarkan namanya ke buku tamu — datanya menggantung.

### ❌ Aturan 4: Hasil Survey "Tertarik" harus otomatis lanjut jadi Booking
**Yang seharusnya terjadi:** Kalau staff mengisi hasil survey "Tertarik-Lanjut" atau "Booking di tempat", sistem otomatis membuat data booking baru.

**Yang terjadi sekarang:** Survey dan Booking adalah **2 formulir yang benar-benar terpisah**, tidak ada penghubung otomatis. Staff harus buka formulir Booking sendiri secara manual setelah survey selesai, dan tidak ada yang menandai bahwa booking itu berasal dari survey yang mana.

**Ibaratnya:** Formulir pendaftaran sekolah dan formulir bayar uang pangkal adalah 2 kertas terpisah yang tidak ada nomor penghubungnya — gampang tercecer.

### ⚠️ Skenario Tambahan: "Kamar penuh bulan ini, tapi kosong bulan depan"
**Pertanyaan dari pemilik:** Bisakah calon penghuni booking kamar yang baru kosong bulan depan, tanpa harus pilih kamar spesifik dulu?

**Yang terjadi sekarang:** **Belum bisa.** Sistem hanya mengenal status kamar "saat ini" (kosong/terisi), tidak ada konsep tanggal/bulan. Setiap booking **wajib** pilih 1 kamar spesifik yang sedang kosong sekarang — tidak ada cara untuk booking kamar yang "akan kosong nanti".

---

## 4. Kenapa Ini Penting Buat Owner? (Dampak Nyata)

| Masalah | Risiko Nyata |
|---|---|
| Harga kamar bisa dinego di sistem | Staff bisa (sengaja/tidak sengaja) input harga lebih rendah dari seharusnya → kerugian finansial tidak terdeteksi |
| Data booking & harga tersebar di banyak Google Sheet | Kalau 1 sheet lupa diupdate, laporan Dashboard bisa salah tanpa Owner sadar |
| Belum ada otomatisasi Check-in → Penghuni Aktif | Proses jadi tergantung staff ingat manual, rawan human error dan delay pencatatan |
| Survey tidak terhubung ke Booking | Sulit melacak "leads mana yang jadi penghuni", laporan konversi jadi tidak akurat |
| Invoice dikirim lewat sistem luar (Google Apps Script) yang bisa gagal diam-diam | Penghuni bisa saja tidak menerima tagihan tanpa ada yang tahu |

---

## 5. Rekomendasi Urutan Perbaikan

Karena masih ada 3 rencana fitur besar lain yang ingin ditambahkan (maintenance, integrasi stok inventori, integrasi 3 aplikasi), **disarankan urutan berikut** supaya tidak membangun fitur baru di atas fondasi yang masih rapuh:

1. **Pindahkan data inti (Leads, Survey, Booking, Harga Kamar) dari Google Sheets ke Turso**, dan sambungkan `id_kamar` ke tabel kamar resmi supaya harga tidak bisa manual.
2. **Bangun proses otomatis Check-in → buat ID Penghuni → catat ke tabel Penghuni Aktif** (saat ini belum ada sama sekali).
3. **Baru setelah itu**, lanjutkan ke fitur-fitur baru (maintenance ke pengeluaran, integrasi stok, integrasi 3 aplikasi) — supaya fitur baru dibangun di atas data yang sudah konsisten.

---

## 6. Catatan Teknis (Untuk Referensi, Boleh Dilewati)

Detail file kode dan bukti audit tersedia di histori percakapan sesi ini (nama file & baris kode untuk setiap temuan). Jika perlu ditelusuri ulang, hal berikut ini titik masuk paling penting:

- Koneksi Turso Mini App: `src/lib/turso.ts`
- Koneksi Google Sheets: `src/lib/google.ts`, `src/lib/sheets.ts`, `src/config/spreadsheets.ts`
- Formulir Booking: `src/lib/modules/handlers/penghuni-baru.ts`, `src/lib/modules/registry.ts`
- Formulir Survey: `src/lib/modules/handlers/survey.ts`
- Perhitungan DP: `src/lib/modules/handlers/pembayaran-sewa-preview.ts`

---

*Laporan ini dibuat otomatis berdasarkan pengecekan langsung ke source code, bukan asumsi. Jika ada bagian yang kurang jelas, tanyakan saja bagian mana yang ingin dijelaskan lebih detail.*
