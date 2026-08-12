# Workstream C — Sistem Akuntansi PSAK (Analisis + Desain)

Tanggal: 2026-08-12
Sumber referensi: Spreadsheet "Laporan Keuangan" (ID `1oLGpqG8bv5a4b-H2GhKMbgcqyKZXLhRioTK3gCZQcxI`, milik user, read-only).

## 1. Arsitektur spreadsheet referensi

Sheet: Petunjuk, Pengaturan, Transaksi, Jurnal Umum, Buku Besar, Neraca Saldo, Daftar Akun, Input Sewa Dimuka, Laba Rugi, Neraca, Arus Kas.

Alur data:
```
Transaksi → Neraca Saldo (mesin hitung per akun) → Laba Rugi / Neraca / Arus Kas
Jurnal Umum & Buku Besar baca langsung dari Transaksi
```

Prinsip periode:
- **Laba Rugi & Arus Kas** = arus SELAMA bulan terpilih.
- **Neraca & Neraca Saldo** = posisi SAMPAI akhir bulan terpilih.
- Saldo kas awal & laba ditahan dihitung otomatis dari transaksi SEBELUM periode.

Cek kebenaran (harus 0): Neraca Saldo Debit=Kredit; Neraca Aset−Pasiva=0; Arus Kas vs saldo kas=0.

## 2. Model pencatatan (Transaksi)

Kolom input: `Tanggal | Akun Debit | Akun Kredit | Nominal | Keterangan` (sisanya turunan).
**1 baris = 1 jurnal seimbang** (double-entry). Ini **sama persis** dengan tabel Turso `jurnal_transaksi(tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan)`.

## 3. Daftar Akun = COA (SUDAH cocok dengan Turso)

Kolom: `Kode | Nama Akun | Tipe Akun | Saldo Normal | Kategori Arus Kas | Grup Laporan`.
Tabel `coa` Turso (125 baris) **sudah identik**: `tipe_akun`, `saldo_normal`, `kategori_arus_kas`, `grup_laporan` memakai vokabuler yang sama. **Tidak perlu ubah COA.**

Tipe Akun: Aset, Kontra Aset, Liabilitas, Ekuitas, Kontra Ekuitas, Pendapatan, Beban, Beban Non-Operasional.
Kategori Arus Kas: Operasional, Investasi, Pendanaan, Non-Operasional.
Grup Laporan (peta baris laporan): Kas & Bank, Piutang Sewa, Perlengkapan, Peralatan Operasional, Tanah, Bangunan, Furniture, Elektronik, Akum {Bangunan/Elektronik/Furniture/Peralatan}, Hutang, Hutang Sewa, Pendapatan Dimuka, Modal, Prive, Pendapatan Sewa, Pendapatan Tambahan, Beban Operasional, Beban Bunga, HPP Perawatan, Beban Penyusutan.

## 4. INTI PSAK: Sewa dibayar di muka (deferred revenue)

Setiap sewa bayar di muka dicatat DUA tahap:
1. **Penerimaan kas** (nominal penuh, mis. 3 bln = 2.550.000):
   `Debit Kas (Rekening Ops) / Kredit Pendapatan Diterima di Muka (2105)`
   → masuk **Arus Kas** (inflow operasional), TIDAK masuk Laba.
2. **Pengakuan pendapatan** per bulan (mis. 850.000), bertanggal awal tiap bulan:
   `Debit Pendapatan Diterima di Muka (2105) / Kredit Pendapatan Sewa (4101)`
   → masuk **Laba Rugi**, TIDAK masuk Arus Kas.

Konsekuensi (contoh user): Arus Kas Penerimaan Sewa = Rp30.550.000 (kas penuh) vs Laba Rugi Penerimaan Sewa = Rp11.825.000 (diakui saja); selisih Rp18.650.000 = saldo liabilitas "Pendapatan Diterima di Muka" di Neraca. Ketiga laporan rekonsiliasi lewat akun 2105.

## 5. Format laporan target (persis permintaan user)

### Laba Rugi (periode)
- PENDAPATAN: Penerimaan Sewa Kamar (grup `Pendapatan Sewa`) + Pendapatan Tambahan (grup `Pendapatan Tambahan`) → Total Pendapatan
- HPP: Beban Perbaikan & Perawatan (grup `HPP Perawatan`) → **Laba Kotor** = Total Pendapatan − HPP
- BEBAN OPERASIONAL (grup `Beban Operasional`, per akun):
  Listrik(5101) · Gaji Karyawan(5104) · Internet(5102) · PBB(5106) · Iuran Lingkungan(5103) · Pemasaran(5105) · Beban Bahan & Perlengkapan(5108 + 5110–5118) → Total → **Laba Operasional** = Laba Kotor − Total
- BEBAN NON-OPERASIONAL: Penyusutan Bangunan/Elektronik/Furniture/Peralatan(6101–6104, grup `Beban Penyusutan`) · Bunga Pinjaman(5107, grup `Beban Bunga`) → Total → **LABA BERSIH** = Laba Operasional − Total

### Arus Kas (periode) — hanya transaksi yang menyentuh akun Kas & Bank
- Arus Kas Awal Periode = saldo Kas & Bank sampai SEBELUM tgl awal periode
- OPERASIONAL: Penerimaan Sewa Kamar, Penerimaan Tambahan, Pembayaran Bunga Hutang, Pembayaran Operasional Lainnya (dikelompokkan via `kategori_arus_kas`='Operasional' lawan-akunnya) → Arus Kas Bersih Operasional
- INVESTASI: Penjualan/Pembelian Aset (`kategori_arus_kas`='Investasi') → bersih
- PENDANAAN: Setoran Modal, Prive/Pelunasan Pokok (`kategori_arus_kas`='Pendanaan') → bersih
- Kenaikan/Penurunan Kas Bersih = jumlah 3 aktivitas; **Arus Kas Akhir** = Awal + Kenaikan

### Neraca (posisi s/d akhir periode)
- ASET LANCAR: Kas dan Bank(`Kas & Bank`), Piutang Sewa, Perlengkapan | ASET TETAP: Tanah, Bangunan, Peralatan Ops, Furniture, Elektronik, dikurangi Akum Penyusutan
- KEWAJIBAN: Hutang, Hutang Sewa, Pendapatan Diterima di Muka(`Pendapatan Dimuka`)
- EKUITAS: Modal Awal, Laba Ditahan (laba akumulasi sebelum tahun berjalan), Laba Tahun Berjalan (pendapatan−beban tahun berjalan s/d periode), Prive
- CEK: Total Aset = Total Pasiva.

## 6. Kondisi sistem web saat ini & GAP

Sudah benar:
- `coa` (125 akun) identik dengan Daftar Akun. ✅
- `jurnal_transaksi` = model double-entry per baris. ✅
- `src/lib/laporan/generator.ts` sudah query Laba Rugi/Arus Kas per periode & Neraca kumulatif (logika dasar benar).

Gap yang ditemukan (lebih kecil dari dugaan):
- **G1 (format laporan) — DITUTUP (C-1 ✅):** `generator.ts` lama mengelompokkan per `tipe`/`kategori`, BUKAN baris persis format user. Sudah di-rewrite: mesin `neracaSaldo()` per akun → `buildLabaRugi/buildArusKas/buildNeraca` menghasilkan struktur §5 lengkap dg baris turunan (Laba Kotor/Operasional/Bersih, Arus Kas Awal/Akhir, Laba Ditahan vs Tahun Berjalan). `template.ts` render ke layout persis. **Terverifikasi: Neraca Juni 2026 seimbang (Total Aset = Total Pasiva, selisih 0).**
- **G2 (deferred revenue) — SUDAH ADA:** ternyata `src/lib/jurnal.ts` `barisJurnalSewa` SUDAH menerapkan pola 2 tahap §4 (terima→2105, pengakuan per bulan 2105→4101, denda→4102, DP→2104). **Tidak perlu diubah.** Ini sebabnya data live sudah punya saldo "Pendapatan Diterima di Muka" & laporan rekonsiliasi benar.
- **G3 (saldo awal) — DITUTUP (C-1 ✅):** `buildArusKas` hitung saldo kas awal dari transaksi < dari; `buildNeraca` hitung Laba Ditahan (akumulasi sebelum tahun berjalan) vs Laba Tahun Berjalan.

## 7. Sisa pekerjaan (opsional, fase lanjut)

- **C-3 Penyusutan aset tetap:** baris Penyusutan (6101–6104) di Laba Rugi/Neraca akan tetap 0 sampai ada entri penyusutan bulanan. Perlu: register aset + umur manfaat + mekanisme posting bulanan. Butuh keputusan bisnis (metode & umur). Belum diimplementasi.
- **(opsional) Tampilan laporan on-screen:** saat ini laporan hanya di-generate jadi PDF (arsip Drive + email). Bila ingin lihat di layar, tambah endpoint render HTML di panel.

Tabel baru: **tidak perlu** — COA (125 akun) + `jurnal_transaksi` sudah cukup untuk seluruh sistem PSAK ini.
```
