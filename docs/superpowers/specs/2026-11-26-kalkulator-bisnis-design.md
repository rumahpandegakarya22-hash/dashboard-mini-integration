# Kalkulator Analisis Bisnis (Owner) — Design

Tanggal: 2026-11-26 · Branch: `feat/kalkulator-bisnis` · Status: menunggu persetujuan

## 1. Maksud

Owner punya spreadsheet "kalkulator Keuangan Kost Tiga Dara" untuk menghitung biaya listrik, biaya operasional, BEP, margin, payback, ROI, CAC, dan OER. Formulanya banyak yang salah (lihat §3) dan sebagian angka diketik manual sehingga tidak ikut berubah. Kalkulator ini dipindah ke Dashboard sebagai menu **khusus Owner**: simulator interaktif (slider, checkbox, input angka) dengan grafik, bisa dibuka di laptop dan HP, dengan formula yang sudah dibetulkan.

## 2. Tujuan, bukan-tujuan, anti-tujuan

**Tujuan**
- Semua hitungan spreadsheet tersedia, dengan formula yang benar dan satuan yang konsisten (bulanan vs tahunan dipisah tegas).
- Setiap angka turunan dihitung dari input. Tidak ada angka hasil yang diketik manual.
- Interaktif: hasil dan grafik berubah langsung saat input digeser atau dicentang.
- Skenario bisa disimpan, dibuka lagi, diduplikasi, dan dihapus.
- Hanya role `owner` yang bisa melihat menu, membuka halaman, dan memanggil API-nya.
- Responsif: nyaman dipakai di laptop dan HP.

**Bukan tujuan (MVP)**
- Mengambil data riil dari database (kamar, jurnal, aset). Owner memilih pendekatan A (simulator manual).
- Membandingkan dua skenario berdampingan, ekspor PDF/Excel, berbagi skenario ke role lain.
- Perhitungan pajak yang rinci. Yang disediakan hanya persentase opsional atas pendapatan.

**Anti-tujuan** (gagal walaupun "jalan")
- Pengawas atau role lain bisa membuka kalkulator.
- Ada angka hasil yang tidak sinkron dengan inputnya, mengulang masalah sheet.
- Bulanan dan tahunan tercampur dalam satu angka.
- Tampilannya berbeda gaya dari dashboard yang sudah ada.

## 3. Koreksi formula dari spreadsheet

| # | Di sheet | Masalah | Di kalkulator |
|---|----------|---------|---------------|
| 1 | Laba bersih `AE12` = margin bulanan + "Kenaikan Laba" tahunan; payback = 1 bulan | Satuan tercampur | Semua angka dasar **per bulan**. Angka tahunan = bulanan × 12, diberi label jelas. Payback upgrade = biaya ÷ tambahan laba **per bulan** |
| 2 | BEP `AA26` = total biaya ÷ "margin" yang sudah dikurangi biaya tetap | Biaya tetap terhitung dua kali | BEP = total biaya tetap ÷ WACM. CM per tipe = harga − biaya variabel per kamar terisi |
| 3 | Faktor 0,707 pada alat induktif, dipakai dua kali (`E12` lalu `G12`) | Watt label sudah daya nyata. PLN menagih kWh | Faktor 0,707 dihapus. Diganti **faktor pemakaian %** (default 100%) untuk alat yang menyala-mati seperti kulkas |
| 4 | Listrik fasum 650rb, listrik per kamar 74.331, kenaikan opex 830rb, pembagi `/30` diketik manual | Tidak ikut berubah | Semua dihitung dari input. Jumlah kamar dihitung dari data tipe kamar |
| 5 | Bulan = 31 hari | Melebih-lebihkan | Input "hari per bulan", default 30 |
| 6 | Kebersihan KM Classic/Comfy masuk biaya tetap dan biaya variabel sekaligus (selisih 100rb antara `V35` dan `AE40`) | Dobel | Setiap item biaya hanya ada di satu tempat, dengan satu sifat: tetap atau variabel |
| 7 | Listrik kamar Classic/Comfy (ber-AC) tidak dihitung | Biaya hilang | Setiap tipe kamar punya daftar alat listriknya sendiri. Default Classic/Comfy dikosongkan dan diberi peringatan untuk diisi owner (lihat §9) |
| 8 | Servis AC dianggap biaya variabel | Servis AC terjadwal, kamar kosong pun tetap diservis | Default: tetap. Sifat tiap item bisa diubah lewat checkbox |

Konsisten dengan dashboard yang sudah ada (commit `a6d1924`): **OPEX tidak termasuk penyusutan dan bunga**. Penyusutan hanya mengurangi laba.

## 4. Model hitung

Semua fungsi murni di `src/lib/kalkulator/hitung.ts`, tanpa I/O, dipakai klien untuk tampilan langsung dan server untuk validasi. Nilai dihitung dalam float dan baru dibulatkan saat ditampilkan.

### Input (`SkenarioInput`, disimpan sebagai JSON)

- **Umum:** `hariPerBulan` (1–31, default 30), `tarifListrik` Rp/kWh (default 1.444), `pajakAktif` (checkbox) + `pajakPersen` atas pendapatan (default 0, nonaktif).
- **Alat listrik** (dipakai di beberapa tempat): `{ nama, watt, jumlah, jamPerHari (0–24), faktorPemakaian % (1–100), aktif }`.
  - kWh/bulan = watt × jumlah × jam × hari × faktor / 1000. Biaya = kWh × tarif.
- **Tipe kamar[]:** `{ nama, jumlahKamar, kamarTerisi (0..jumlahKamar), hargaSewa, alatListrik[], itemBiaya[] }`.
  - `itemBiaya`: `{ nama, nominal per kamar per bulan, sifat: 'tetap'|'variabel', penyusutan: boolean, aktif }`.
  - Listrik kamar dari `alatListrik` selalu variabel (hanya kamar terisi).
- **Biaya bersama (fasum)[]:** `{ nama, jumlah, harga, penyusutan: boolean, aktif }`. Selalu tetap.
  - Ada item khusus **Listrik Fasum** yang dihitung dari daftar `alatListrikFasum[]`.
  - **Pembantu PBB:** `pbbTahunan`, `luasRumah`, `luasKos` → PBB kos per bulan = pbbTahunan × luasKos / (luasRumah + luasKos) / 12. Hasilnya masuk sebagai item fasum.
- **Investasi:** `modalAwal` (total modal usaha, opsional, untuk ROI dan payback usaha).
- **Skenario upgrade** (checkbox `aktif`): `biayaInvestasi`, `kenaikanSewaPerKamar`, `kamarTerdampak`, `tambahanBiayaPerBulan`.
- **Akuisisi penghuni:** `biayaAkuisisi[]` `{ nama, nominal }`, `penghuniBaru`.
- **Kalkulator barang tambahan penghuni** (alat bantu menentukan tarif tagihan `tambahan_listrik`): `alatTambahan[]`, `pembulatanKe` (default 5.000). Tidak masuk laba usaha.

### Output (per bulan, kecuali disebut lain)

- Pendapatan = Σ terisi × harga.
- Biaya variabel = Σ terisi × (listrik kamar + item variabel).
- Contribution margin per tipe: CM = harga − biaya variabel per kamar terisi. CM ratio = CM / harga.
- Biaya tetap = Σ fasum aktif + Σ jumlahKamar × item tetap per kamar (kamar kosong tetap menanggung).
- Penyusutan = bagian biaya tetap yang ditandai penyusutan.
- **OPEX** = biaya variabel + biaya tetap − penyusutan. **OER** = OPEX / pendapatan.
- Laba sebelum pajak = pendapatan − biaya variabel − biaya tetap. Pajak = pajakPersen × pendapatan bila aktif. **Laba bersih** = laba sebelum pajak − pajak.
- Bila upgrade aktif, upgrade ikut mengubah angka utama: pendapatan + kamarTerdampak × kenaikan, biaya tetap + tambahanBiaya.
- **WACM** = Σ CM_i × (jumlahKamar_i / total kamar). Bauran memakai kapasitas, bukan kamar terisi.
- **BEP** = ceil(biaya tetap / WACM) kamar, BEP okupansi % = BEP / total kamar. BEP pendapatan = biaya tetap / (Σ CM_i × mix_i / Σ harga_i × mix_i).
- **Margin of safety** = (terisi − BEP) / terisi.
- Laba per kamar per tipe (alokasi): CM − (fasum / total kamar) − item tetap per kamar.
- **ROI tahunan** = laba bersih × 12 / modalAwal. **Payback usaha** = ceil(modalAwal / laba bersih) bulan.
- **Upgrade:** Δlaba = kamarTerdampak × kenaikan − tambahanBiaya. Payback = ceil(biaya / Δlaba) bulan. ROI tahunan = Δlaba × 12 / biaya.
- **CAC** = Σ biaya akuisisi / penghuniBaru. CAC payback = CAC / WACM (bulan).
- **Kurva sensitivitas:** laba bersih untuk okupansi 0–100% (langkah 5%, bauran kapasitas), untuk grafik dan penanda BEP.

**Kasus tepi** (wajib ditangani, tidak boleh muncul NaN, Infinity, atau angka negatif yang menyesatkan):
- Pembagi nol (pendapatan 0, penghuniBaru 0, modal 0, total kamar 0) → hasil `null`, tampil "—".
- WACM ≤ 0 → BEP "tidak tercapai".
- Laba atau Δlaba ≤ 0 → payback "tidak balik modal".

### Angka acuan (skenario default = input sheet setelah dikoreksi; jadi golden test)

Skenario default: upgrade **nonaktif**, pajak nonaktif, `modalAwal` 0 (sheet tidak punya angka modal total, sehingga ROI/payback usaha tampil "—" sampai diisi). Angka upgrade di bawah dihitung dengan upgrade dicentang.

| Besaran | Nilai |
|---|---|
| Pendapatan | Rp28.050.000 |
| Listrik fasum (8,0 kWh/hari, 30 hari) | Rp346.560 |
| Listrik per kamar Eco | Rp86.423,40 |
| PBB kos / bulan | Rp190.944,12 |
| Biaya variabel | Rp2.410.585 |
| Biaya tetap | Rp9.992.504,12 |
| Penyusutan | Rp4.480.000 |
| OPEX / OER | Rp7.923.089,12 / 28,25% |
| Laba bersih (tanpa pajak) | Rp15.646.910,88 |
| WACM | Rp854.647,17 |
| BEP | 12 kamar (40%), margin of safety 60% |
| Upgrade 17 jt, +30rb × 30 kamar, +830rb/bln | Δlaba Rp70.000/bln · payback 243 bln · ROI 4,94%/thn |
| CAC (Mamikos 50rb / 8 penghuni) | Rp6.250 |

Isi default lengkap (daftar alat, item biaya per tipe) diambil dari sheet dan ditulis sebagai konstanta `SKENARIO_DEFAULT` di `src/lib/kalkulator/default.ts`. Watt dispenser kosong di sheet, jadi diisi 240 W (diturunkan dari kWh 0,96/hari yang tertulis di sheet).

## 5. Pendekatan

| | Pendekatan | Trade-off |
|---|---|---|
| **A (dipilih owner)** | Simulator manual: semua input diketik atau digeser owner, skenario disimpan | Sederhana, berdiri sendiri. Angka bisa berbeda dari kondisi riil |
| B | Prefill dari data riil (kamar, aset tetap, jurnal) lalu bisa diubah | Lebih dekat ke kenyataan. Butuh pemetaan akun jurnal ke tetap/variabel, lebih besar |
| C | Dashboard otomatis tanpa simulasi | Bukan kalkulator. Dicoret |

B bisa jadi tahap berikutnya: struktur `SkenarioInput` sudah cukup untuk diisi otomatis nanti.

## 6. Arsitektur

### Backend
- **Migrasi** `db/schema/037_kalkulator_skenario.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS kalkulator_skenario (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nama        TEXT NOT NULL,
    data        TEXT NOT NULL,            -- JSON SkenarioInput
    versi       INTEGER NOT NULL DEFAULT 1, -- versi skema JSON
    dibuat_oleh TEXT NOT NULL,
    diubah_oleh TEXT NOT NULL,
    dibuat_pada TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    diubah_pada TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    dihapus_pada TEXT                       -- soft delete
  );
  ```
  Soft delete dipakai karena `writeAudit` hanya mengenal `CREATE`/`UPDATE`. Menghapus dicatat sebagai `UPDATE` yang mengisi `dihapus_pada`.
- **Route** `src/app/api/dashboard/kalkulator/route.ts`: `GET` (daftar + isi), `POST` (buat), `PUT` (ubah/simpan, termasuk soft delete lewat field `hapus: true`).
  - Setiap handler: `requireDashboardAuth('kalkulator')` (sesi Clerk, status aktif, 2FA, rate limit 120/menit) → `requireOwner(user)` → validasi body dengan **zod** (`src/lib/kalkulator/skema.ts`).
  - Batas zod: semua angka `finite` dan ≥ 0 dengan batas atas wajar (harga ≤ 1e10, watt ≤ 1e5, jam ≤ 24, faktor 1–100, hari 1–31, jumlah kamar ≤ 1000, kamar terisi ≤ jumlah kamar). String ≤ 80 karakter. Array ≤ 50 baris. Nama skenario 1–80 karakter. Body > 64 KB ditolak.
  - Query selalu parameterized (`?`). JSON disimpan setelah lolos zod (yang disimpan hasil `parse`, bukan body mentah).
  - Setiap tulis memanggil `writeAudit` (`moduleId: 'kalkulator'`, `target: 'Turso → kalkulator_skenario'`).
  - Batas 100 skenario aktif.

### Frontend
- **Navigasi:** `ROLE_NAV.owner.pages` = `pagesFor('Owner')` + `{ id: 'kalkulator', label: 'Kalkulator Bisnis', group: 'dash', crumb: 'Kalkulator Bisnis' }`. **Tidak** ditambahkan ke `OWNER_PAGES` supaya Pengawas tidak ikut. `canOpenView` otomatis menolak Pengawas (404).
- **Halaman:** `src/app/(dashboard)/dashboard/[view]/page.tsx` diberi cabang `view === 'kalkulator'`. Cabang ini memeriksa ulang `user.role === 'owner'` (lapis kedua), **tidak** memanggil `loadDashboardData` (tidak butuh data dashboard), dan merender `<KalkulatorBisnis />` di dalam `DashboardShell`. Sebelum ditambah, cek ulang apakah ada tempat lain yang mengasumsikan setiap view `dash` adalah overview (misalnya `OverviewFor`).
- **Komponen** di `src/components/kalkulator/` (client):
  - `KalkulatorBisnis.tsx`: state `SkenarioInput` (`useReducer`), `useMemo(hitung)`, bilah skenario (pilih / simpan / simpan sebagai / duplikat / hapus / reset ke default), penanda "belum disimpan", dan peringatan `beforeunload` saat ada perubahan.
  - Panel input (dalam `Accordion` yang sudah ada): Umum · Tipe Kamar · Biaya Bersama · Listrik · Investasi & Upgrade · Akuisisi · Barang Tambahan Penghuni.
  - `InputAngka` = slider + kotak angka berpasangan (nilai tetap sinkron, format Rupiah saat tidak difokus, `inputMode="numeric"`). Checkbox untuk `aktif`, `penyusutan`, dan sifat tetap/variabel. Tombol tambah/hapus baris.
  - Hasil: `StatGrid` dengan palet Owner (`G.ownPrimary/ownRose/ownGray`): Pendapatan, Laba Bersih, OPEX, OER, BEP, Margin of Safety, ROI, Payback, CAC.
  - Grafik memakai komponen yang ada: `AreaLine` (laba vs okupansi; penanda BEP perlu ditambahkan, atau dibuat komponen kecil bila `AreaLine` tidak mendukung garis penanda), `DonutBlock` (komposisi biaya: variabel / tetap / penyusutan; komposisi pendapatan per tipe), `Bars` (CM dan laba per kamar per tipe), `BarStopsOwner` untuk gradien.
  - Tabel rincian per tipe kamar (`Table` yang ada).
- **Responsif:** di laptop, input di kolom kiri dan hasil + grafik di kanan (sticky). Di HP, satu kolom dengan ringkasan (Laba, BEP, OER) menempel di atas saat menggulir, dan accordion input di bawah grafik. Target sentuh ≥ 44 px. Tidak ada scroll horizontal di lebar 360 px. Tabel lebar dibungkus `overflow-x:auto`.
- **Gaya:** kelas dan token dari `src/styles/theme-dashboard.css` (termasuk mode gelap lewat `ThemeToggle`). Animasi pakai `framer-motion` / `Reveal` yang sudah ada. Tidak menambah dependensi baru.

### Keamanan (ringkas)
- Gerbang tiga lapis: nav (menu tidak muncul) → halaman (`canOpenView` + cek `owner`) → API (`requireOwner`).
- 2FA dan status akun ditegakkan `requireDashboardAuth`. Rate limit Redis.
- Validasi zod ketat, query parameterized, batas ukuran body/array/string, soft delete dan audit untuk setiap perubahan.
- Tidak ada `dangerouslySetInnerHTML`. Nama skenario dirender React (ter-escape). CSP yang sudah ada tidak diubah.
- Respons error tidak membocorkan detail internal (pola pesan `api-guard`).

## 7. Pengujian
- Unit test `src/lib/kalkulator/hitung.test.ts` dan `skema.test.ts` (runner `tsx --test`, pola yang sudah ada): golden test angka §4, semua kasus tepi, satuan bulanan/tahunan, toggle aktif/penyusutan/variabel, upgrade aktif/nonaktif, dan zod menolak input di luar batas.
- Ditambahkan ke script npm `test:kalkulator`.
- `npm run typecheck` dan `npm run build` harus bersih.
- E2E (Playwright, manual lewat dev server): owner membuka menu, menggeser slider sehingga angka dan grafik berubah, lalu menyimpan → memuat ulang → menghapus. Pengawas tidak melihat menu, `/dashboard/kalkulator` 404, dan API 403. Dicek di lebar 1440 dan 375.

## 8. Keputusan yang saya ambil (silakan koreksi)
1. Hari per bulan default 30, faktor 0,707 dihapus, diganti faktor pemakaian.
2. Servis AC dan penyusutan = tetap. Listrik kamar dan kebersihan KM dalam = variabel.
3. Bauran WACM memakai kapasitas kamar.
4. Pajak berupa persentase opsional atas pendapatan, default nonaktif.
5. Upgrade yang dicentang ikut mengubah angka utama. Ringkasan Δ-nya ditampilkan terpisah.
6. Watt dispenser = 240 W.
7. Kalkulator barang tambahan penghuni dipertahankan sebagai alat bantu tarif, terpisah dari laba.
8. Simpan eksplisit (tombol), bukan autosave.

## 9. Diserahkan ke owner untuk diisi di aplikasi
- Alat listrik kamar Classic dan Comfy (AC, water heater, TV) beserta siapa yang menanggung listriknya. Default dikosongkan dan diberi peringatan "listrik kamar belum diisi".
- Jam pakai hair dryer di sheet tertulis 7,5 jam/hari, kemungkinan maksudnya menit. Default diubah ke 0,25 jam dengan catatan.

## 10. Diserahkan ke builder
Nama komponen dan file internal, detail CSS, langkah slider, cara menambah penanda BEP di grafik, dan pembagian task di plan.
