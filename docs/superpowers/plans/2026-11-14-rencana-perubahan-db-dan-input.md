# Rencana Perubahan Database dan Input Mini App

> Status: **DIKERJAKAN 14 Nov 2026** (fase A-F selesai, migrasi 024-030 terpasang). Ringkasan hasil ada di `docs/SOW-DRAFT.md` bagian 13.
> Tahap berikutnya (setelah disetujui): rencana langkah per langkah (TDD) untuk tiap fase.
> Spec: [docs/SOW-DRAFT.md](../../SOW-DRAFT.md)

**Tujuan:** menambah input Mini App untuk KPI yang belum punya data, menghapus alur Pindah Kamar, melengkapi fitur edit, mengubah definisi response time tiket, dan memindahkan Pengawas ke Dashboard.

**Prinsip pengamanan database (karena dipakai banyak aplikasi):**
1. Hanya `ALTER TABLE ... ADD COLUMN` (nullable, tanpa default wajib) dan `CREATE TABLE IF NOT EXISTS`. Tidak ada DROP, RENAME, atau ubah tipe kolom di fase ini.
2. Aplikasi lain yang menulis ke tabel yang sama tidak rusak, karena kolom baru boleh kosong.
3. Baris lama **tidak diisi tebakan** (tidak ada backfill). Kolom baru kosong dihitung "—" di dashboard dan **tidak** ikut rata-rata, bukan dihitung 0.
4. Tiap migrasi dijalankan lewat `scripts/apply-schema.ts`: dry-run dulu, lalu `--commit`. Backup dulu dengan `scripts/backup-turso.ts`.
5. Urutan rilis: migrasi database → kode yang membaca/menulis → baru UI. Kode baru harus tetap jalan walau kolom baru masih kosong.

---

## 1. Peta Aplikasi yang Menyentuh Database

| Aplikasi | Bukti di repo | Dampak rencana ini |
|---|---|---|
| Mini App Ops + Dashboard (repo ini) | seluruh `src/` | Pengubah utama |
| **Teman Rara** (aplikasi penghuni) | tabel `tr_*` (`tr_pindah_request`, `tr_checkout_request`, `tr_pendaftaran`, `tr_payment_proof`, `tr_account`, `tr_information_board`) | **Terdampak oleh penghapusan Pindah Kamar** (bagian 3). Kodenya tidak ada di repo ini, jadi tidak bisa saya cek |
| Landing page | tabel `landing_*`, migrasi 012–020 | Tidak disentuh. Perlu dipastikan apakah ia menulis ke `leads` (lihat 2.1) |
| Inventory Stock | DB terpisah (`readInventory`, `isInventoryConfigured`) | Tidak disentuh |
| Clerk (login, satu instance dengan Dashboard lama) | `auth.ts` | Pengawas: ubah metadata pengguna, bukan database (bagian 4) |

Catatan struktur: migrasi dijalankan manual (tidak ada runner otomatis). Sebagian tabel dibuat saat runtime lewat kode (contoh `income_non_rent` di `load.ts`), jadi `db/schema/` bukan satu-satunya sumber skema.

---

## 2. Perubahan Skema (nomor lanjut dari `023_*`)

### 2.1 `024_leads_waktu_respons.sql` — respons leads pertama

```sql
ALTER TABLE leads ADD COLUMN masuk_pada TEXT;         -- waktu lead masuk
ALTER TABLE leads ADD COLUMN chat_pertama_pada TEXT;  -- waktu chat pertama dikirim
```

- Rumus KPI: `chat_pertama_pada − masuk_pada` (menit). Target 15 menit.
- Format simpan: `YYYY-MM-DD HH:MM` **waktu WIB tanpa zona**, sama dengan kolom `tanggal` yang sudah ada. Jangan pakai `CURRENT_TIMESTAMP` SQLite (UTC), supaya selisih tidak meleset 7 jam.
- Form Log Leads: dua isian tanggal-jam. `masuk_pada` default "sekarang", bisa diubah. `chat_pertama_pada` boleh kosong (diisi belakangan lewat Edit).
- Risiko: kalau Marketing mencatat lead di akhir hari, waktunya salah dan KPI menyesatkan. Aturan SOP: isi `masuk_pada` dengan waktu **sebenarnya** lead masuk.
- Dampak lintas aplikasi: tambah dua kolom di `SHEET_MAP.leads` (`sheet-map.ts`) **di akhir**, dan cek detektor header fuzzy di dashboard agar "Waktu Masuk" tidak tertukar dengan kolom penghuni. Laporan bulanan membaca `leads`, tidak terpengaruh.
- **Perlu dicek:** apakah landing page atau aplikasi lain menulis ke `leads`. Kalau ya, kolom baru tetap aman (kosong).

### 2.2 `025_maintenance_cm_response.sql` — response time tiket

```sql
ALTER TABLE maintenance_cm ADD COLUMN lapor_pada TEXT;     -- laporan masuk
ALTER TABLE maintenance_cm ADD COLUMN ditindak_pada TEXT;  -- mulai ditindak
```

- Definisi baru: **Response time = `ditindak_pada − lapor_pada` (jam)**, dari laporan masuk sampai penindakan. Menggantikan hitungan lama (`tanggal_kerusakan → tanggal_lapor`, `hydrate.ts:318`).
- `lapor_pada` default waktu input, bisa diubah. `ditindak_pada` terisi otomatis saat status tiket pertama kali berubah ke "Proses"; bisa diedit manual.
- Resolution time **tidak diubah** (tetap `tanggal_kerusakan → tanggal_selesai`).
- Baris lama: kedua kolom kosong, response time tampil "—". **Tidak** di-backfill.
- `maintenance_pm` (preventif) **tidak diubah**: preventif terjadwal, tidak punya "laporan masuk".
- Tambah dua kolom di `SHEET_MAP.maintenance_cm` (akhir). Kolom `kode`, `durasi_perbaikan_hari`, `sla` tetap dihitung `compute.ts`/`recompute-turso.ts`.
- Opsional: `work_orders` (tiket antar divisi) dapat kolom serupa `ditindak_pada` bila response time WO juga mau dihitung. Default: **tidak** di fase ini.

### 2.3 `026_content_biaya.sql` — biaya konten untuk CAC

```sql
ALTER TABLE content ADD COLUMN biaya_produksi INTEGER;  -- rupiah penuh
```

- CAC = (Σ `promotion.spend_aktual` + Σ `content.biaya_produksi`) ÷ booking baru pada periode.
- `content` punya kolom formula beku (`engagement`, `er_persen`). Kolom baru tidak termasuk daftar formula, jadi aman dari `recompute-turso.ts`.
- Konsistensi posting memakai `content.status` yang sudah ada (nilai "Terjadwal"/"Terbit"); **perlu dicek** isi pilihan `Status Konten` di tabel `settings` sebelum rumus ditetapkan.

### 2.4 `027_checkout_kamar_siap.sql` — kesiapan kamar

```sql
ALTER TABLE checkout_log ADD COLUMN kamar_siap_pada TEXT;
ALTER TABLE checkout_log ADD COLUMN kamar_siap_oleh TEXT;
```

- Operasional menandai "kamar siap sewa" lewat tombol di modul Checkout / Inspeksi Kebersihan.
- Rumus: `kamar_siap_pada − tanggal_checkout`. `tanggal_checkout` hanya tanggal (tanpa jam), jadi satuannya **hari** (target 24 jam menjadi ≤ 1 hari), kecuali ditambah kolom `checkout_pada` berjam.

### 2.5 `028_csat.sql` — kepuasan penghuni (tabel baru)

```sql
CREATE TABLE IF NOT EXISTS csat_response (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  id_penghuni  TEXT NOT NULL REFERENCES occupancy_history (id_penghuni),
  periode      TEXT NOT NULL,                       -- 'YYYY-MM'
  skor         INTEGER NOT NULL CHECK (skor BETWEEN 1 AND 5),
  komentar     TEXT,
  dicatat_oleh TEXT,
  created_at   TEXT DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (id_penghuni, periode)
);
```

- Fase ini: diinput Admin and Finance di Mini App (hasil tanya penghuni). **Tidak** menyentuh Teman Rara.

### 2.6 Tanpa perubahan skema (memakai yang sudah ada)

| KPI | Cara |
|---|---|
| Waktu respons feedback | `tenant_complain.reported_at` dan `responded_at` **sudah ada** (migrasi 004). Cukup ditampilkan. (Koreksi: di SOW sebelumnya saya tulis perlu kolom baru, ternyata tidak.) |
| Kepatuhan SLA tiket | Kolom `maintenance_cm.sla` ("OK"/"BREACH") sudah dihitung `compute.ts` dengan target **3 hari** (`slaTargetHari`). Lihat keputusan 4 di bagian 8 |
| Tiket berulang | Turunan dari `lokasi_item` + `kategori` |
| Kepatuhan preventif / inspeksi | Turunan dari tanggal jadwal vs selesai |
| Vacancy days | Turunan `occupancy_history` |
| Renewal rate, collection rate, aging tunggakan | Turunan `invoice_sewa`, `active_tenant` |
| Konversi survey → booking | `survey.no_booking` sudah menautkan |
| Dokumen wajib | Daftar jenis wajib disimpan di `settings` (grup baru `DOKUMEN_WAJIB`); dihitung dari `tenant_docs.doc_type` |
| Waktu tutup buku | Usulan: pakai `MIN(laporan_riwayat.created_at)` per `periode` (laporan pertama yang dibuat). Tabel `tutup_buku` baru hanya bila Anda ingin tombol "Tutup buku" eksplisit |

---

## 3. Hapus Alur Pindah Kamar

**Prinsip data:** tabel dan baris **tidak dihapus**. `rooms_transfer` tetap sebagai riwayat; `occupancy_history` dan `active_tenant` sudah mencerminkan kamar terakhir. Yang dihapus hanya kode yang menulis.

| Berkas | Tindakan |
|---|---|
| `src/lib/modules/registry.ts` | Hapus modul `pindah-kamar` |
| `src/lib/modules/handlers/pindah-kamar.ts` | Hapus berkas |
| `src/lib/modules/handlers/index.ts` | Hapus impor dan entri |
| `src/lib/core/roles.ts` | Hapus `'pindah-kamar'` dari `MODULE_ACCESS` |
| `src/lib/core/roles.test.ts` | Sesuaikan tes |
| `src/lib/modules/panel.ts`, `src/components/ModulePanel.tsx` | Hapus panel pengajuan pindah |
| `src/app/api/ops/pengajuan/route.ts` | Hapus cabang `pindah` dan impor `submitPindahKamar`; cabang `checkout` **tetap** |
| `src/components/PendingAnnouncement.tsx` | Hapus hitungan `tr_pindah_request` |
| `src/components/module-icons.tsx` | Hapus ikon dan id dari grup divisi |
| `src/lib/master.ts` | Hapus `kamar-kosong-turso` bila tidak dipakai modul lain (cek dulu) |
| `src/lib/modules/edit.ts` | Hapus komentar rujukan |
| `docs/RENCANA-PINDAH-CHECKOUT.md` | Tandai bagian pindah kamar usang |

**Dampak ke Teman Rara (perlu keputusan):** penghuni masih bisa mengirim pengajuan pindah dari aplikasinya ke `tr_pindah_request`. Setelah fitur ini dihapus di Mini App, pengajuan baru **tidak ada yang menangani** dan tidak muncul di pengumuman. Pilihan: (a) fitur pindah di Teman Rara juga dihilangkan, atau (b) pengajuan tetap masuk dan ditangani di luar sistem. Tabel `tr_pindah_request` **tidak dihapus** oleh saya karena milik Teman Rara.

---

## 4. Pengawas: dari Mini App ke Dashboard

Tidak ada perubahan database. Yang berubah adalah kode dan metadata Clerk.

| Berkas | Tindakan |
|---|---|
| `roles.ts` | Tambah `'pengawas'` ke `DASHBOARD_ROLES`; keluarkan dari `ROLES` Mini App (pisahkan daftar role Ops dan Dashboard) |
| `auth.ts` | `metaRole`/`dashRole`: Pengawas hanya dikenali di namespace Dashboard |
| `dashboard-nav.ts` | Tambah entri `ROLE_NAV.pengawas` |
| `dashboard-access.ts`, `rls.ts` | Tentukan akses data Pengawas |
| `canAccess`, `canUseInventory`, `inventory-api-guard.ts`, `joblist.ts` | Hapus cabang `pengawas` di sisi Ops |
| `scripts/migrasi-role-clerk.ts` | Skrip satu kali: pengguna yang `miniappRole='pengawas'` diubah ke `role='pengawas'` dan `miniappRole` dihapus |
| Panel kelola user Mini App | Hapus opsi role Pengawas; pindahkan ke panel user Dashboard |

Risiko: akun Pengawas yang sekarang aktif di Mini App kehilangan akses Mini App begitu kode naik. Jalankan skrip migrasi Clerk **sebelum** deploy kode.

---

## 5. Input Baru di Mini App

| Modul | Penambahan | Butuh migrasi |
|---|---|---|
| Log Leads | `masuk_pada`, `chat_pertama_pada` | 024 |
| Perbaikan Korektif | `lapor_pada` (otomatis), `ditindak_pada` (otomatis saat status → Proses, bisa diedit) | 025 |
| Log Konten | `biaya_produksi`; pastikan pilihan status memuat Terjadwal dan Terbit | 026 |
| Checkout / Inspeksi Kebersihan | Tombol "Kamar siap sewa" | 027 |
| Modul baru "Kepuasan Penghuni" (Admin and Finance) | Skor 1–5 per penghuni per bulan | 028 |
| Pengaturan | Daftar dokumen wajib penghuni | tidak |

---

## 6. Fitur Edit yang Ditambah

Tidak butuh perubahan skema. Semua tercatat otomatis di `audit_log` (aksi `UPDATE`).

| Modul | Tabel yang di-UPDATE | Catatan |
|---|---|---|
| Inspeksi Kebersihan | `inspeksi_kebersihan` | Alasan pengecualian lama sudah tidak berlaku (komentar di `edit.ts:19`) |
| Tambah Vendor | `vendor` | Sederhana |
| Tambah Waiting List | `waiting_list` | Sederhana |
| Aktivitas Finansial | `jurnal_transaksi` | **Berisiko akuntansi**, lihat di bawah |
| Pembayaran Sewa | — | **Tidak ditambah** (efek berantai). Butuh keputusan |
| Pindah Kamar | — | Dihapus |

Temuan: konfigurasi edit bernama `pengeluaran` menempel pada modul `pengeluaran` yang `ready:false` (tidak tampil). Jadi modul **Aktivitas Finansial yang aktif sebenarnya belum punya edit**. Edit ini harus dipasang ke `aktivitas-finansial`.

Risiko edit jurnal: (1) pengeluaran "beban dibayar dimuka" menghasilkan baris amortisasi tambahan; mengubah nominal baris induk tanpa baris anaknya membuat laporan tidak seimbang. Usulan: edit dilarang untuk baris beban dimuka. (2) Laporan yang sudah dibuat di `laporan_riwayat` tidak ikut berubah.

---

## 7. Urutan Fase

| Fase | Isi | Migrasi | Risiko |
|---|---|---|---|
| A | Hapus Pindah Kamar (bagian 3) | tidak | Rendah (kode saja); keputusan Teman Rara dulu |
| B | Pengawas ke Dashboard (bagian 4) | tidak | Sedang (akses akun); migrasi Clerk dulu |
| C | Migrasi 024–028 + backup + dry-run | ya | Rendah (hanya tambah) |
| D | Input baru + definisi response time baru | memakai C | Sedang (rumus dashboard berubah) |
| E | Edit modul yang belum punya | tidak | Rendah; Aktivitas Finansial sedang |
| F | Kartu dashboard Tahap 1 (SOW bagian 8) | tidak | Rendah |

Tiap fase dirilis dan diverifikasi sendiri sebelum fase berikutnya.

---

## 8. Keputusan yang Dibutuhkan Sebelum Mulai

1. **Teman Rara:** form pindah kamar di aplikasi penghuni juga dihilangkan, atau dibiarkan?
2. **Pengawas di Dashboard:** hanya baca semua halaman seperti Owner, ditambah halaman baru "Kontrol Data" (kelengkapan input per divisi)? Atau hanya halaman tertentu?
3. **Waktu respons leads dan tiket:** setuju diinput manual dalam jam WIB (default "sekarang", bisa diubah), dengan risiko pencatatan terlambat?
4. **SLA tiket:** pakai batas **3 hari** seperti kode sekarang (diverifikasi dari spreadsheet asli), atau ubah ke **1 hari** mengikuti target resolution time di SOW?
5. **Kesiapan kamar:** satuan hari (tanpa kolom baru), atau jam (tambah `checkout_pada`)?
6. **Waktu tutup buku:** pakai tanggal laporan pertama di `laporan_riwayat` (tanpa tabel baru), atau tombol "Tutup buku" dengan tabel baru?
7. **Edit Pembayaran Sewa:** tetap tanpa edit (koreksi lewat void), atau dibuat proses void/koreksi khusus?
8. **Edit Aktivitas Finansial:** setuju dilarang untuk baris beban dibayar dimuka?
9. **CSAT:** diinput Admin di Mini App (usulan), atau dikumpulkan lewat Teman Rara?
10. **Dokumen wajib penghuni:** jenis apa saja (misalnya KTP + Surat Kontrak)?
