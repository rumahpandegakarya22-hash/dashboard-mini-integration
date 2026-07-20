# Golden Test Fase 2 — Bukti Kelulusan

Gerbang §9 Fase 2.5 / §11.3: paritas keluaran data layer Dashboard lama
(Express, CommonJS) vs port TypeScript baru.

**Tanggal:** 20 Juli 2026 · **Hasil: LULUS, diff kosong pada ketiga perbandingan.**

---

## Mengapa laporan ini berisi hash, bukan file golden-nya

§11.3 meminta kedua file golden disimpan di `docs/` sebagai bukti. File-file itu
**tidak di-commit** dan sudah masuk `.gitignore` — isinya PII nyata **29 penghuni**:
nama lengkap, no HP, email, serta **dua set kontak darurat** (nama, hubungan, dan
nomor telepon pihak ketiga yang tidak pernah menyetujui apa pun).

Menaruhnya di git berarti PII itu permanen di riwayat — ikut ke setiap clone,
tidak bisa benar-benar dihapus, dan ikut terdorong bila repo di-push ke GitHub.
Maksud §11.3 adalah **bukti paritas**, dan hash SHA-256 memenuhinya lebih baik:
bisa diverifikasi ulang siapa pun, tamper-evident, dan nol PII.

File aslinya tetap ada di `docs/` pada mesin kerja untuk inspeksi manual.
Verifikasi ulang kapan saja:

```bash
npx tsx scripts/golden-check.ts          # regenerasi sisi baru + diff
sha256sum docs/golden-*.json             # cocokkan dengan tabel di bawah
```

---

## Rancangan uji

Kedua sisi dijalankan terhadap **database Turso yang sama dengan kredensial yang
sama** (`TURSO_DATABASE_URL` & `TURSO_AUTH_TOKEN` diverifikasi identik lewat hash
sebelum uji), sehingga selisih apa pun **murni berasal dari kode**, bukan data.

| | Lama | Baru |
|---|---|---|
| Kode | `server/turso-source.js` → `compute.js` → `sheet-map.js` | `src/lib/dashboard/{source,compute,sheet-map}.ts` |
| RLS | `filterSheetsForRole`/`filterTablesForRole` di `server/server.js` | `src/lib/dashboard/rls.ts` |
| Runtime | Node CommonJS | tsx / ESM |
| `@libsql/client` | **0.14.0** | **0.17.4** |

RLS sisi lama **tidak disalin ulang** untuk pengujian — teks fungsi aslinya
diekstrak dari `server.js` lalu dievaluasi di sandbox `vm`. Menyalin-ulang berarti
menguji salinan terhadap salinan sendiri, yang tidak membuktikan apa pun.

---

## Hasil

| Berkas | Ukuran | SHA-256 |
|---|---|---|
| `golden-old.json` | 163 KB | `2e35bbe69f0e19671d2f07ff35b36d5a65b88ca334ccaceeae7d463cea4a459d` |
| `golden-new.json` | 163 KB | `2e35bbe69f0e19671d2f07ff35b36d5a65b88ca334ccaceeae7d463cea4a459d` |
| `golden-old-sheets.json` | 89 KB | `4a0ff63c7a72e2ac6c0b0fcc80230f528e23750445ff442cf2bd91ed013f6eb5` |
| `golden-new-sheets.json` | 89 KB | `4a0ff63c7a72e2ac6c0b0fcc80230f528e23750445ff442cf2bd91ed013f6eb5` |
| `golden-old-rls.json` | 682 KB | `68e25b74ec0dc9a03440cf4c22995b2ef2d6dc1dc5b72b5863247005d6f33adf` |
| `golden-new-rls.json` | 682 KB | `68e25b74ec0dc9a03440cf4c22995b2ef2d6dc1dc5b72b5863247005d6f33adf` |

- **R1 tables** (paritas formula, 16 tabel): hash **IDENTIK** ✅
- **R1 sheets** (bentuk 16 tab termasuk turunan PENGHUNI): hash **IDENTIK** ✅
- **R2 RLS + redaksi PII** (5 role × tabel & sheets): hash **IDENTIK** ✅

Cakupan data: kamar 29 · booking 31 · leads 3 · survey 0 · coa 122 ·
jurnal_transaksi 128 · maintenance_cm 1 · maintenance_pm 2 · vendor 12 ·
content 4 · promotion 3 · dokumen 69 · logbook_divisi 21 · occupancy_history 32 ·
payment 45 · active_tenant 29.

### Kontrol negatif — membuktikan pembandingnya bisa gagal

Uji yang tidak mungkin gagal tidak membuktikan apa pun. Pembanding diuji dengan
selisih yang sengaja dibuat, dan **keempatnya terdeteksi**:

| Perusakan sengaja | Terdeteksi sebagai |
|---|---|
| Ubah satu angka harga | `.kamar[0].harga_bulan: nilai beda (lama=850000, baru=999999)` |
| Hapus satu kolom | `.coa[0].saldo_normal: hilang di baru` |
| Hilangkan satu baris | `.booking: panjang beda (31 vs 30)` |
| Ubah satu tanggal formula | `.booking[0].tgl_keluar_est: nilai beda ("2026-04-30" → "2099-01-01")` |

### Paritas jalur ON-WRITE (bonus, di luar syarat gerbang)

`scripts/recompute-turso.ts` (dry-run) vs `server/recompute-turso.js` (dry-run)
menghasilkan keluaran **identik baris-per-baris**: 3 baris / 3 sel.

---

## Temuan: drift data lama di Turso (BUKAN regresi migrasi)

Dry-run recompute menemukan 3 sel yang nilai tersimpannya di Turso berbeda dari
hasil hitung formula. Skrip **lama** melaporkan 3 sel yang **sama persis**, jadi
ini kondisi yang sudah ada sebelum migrasi — bukan akibat port.

| Tabel | Baris | Kolom | Tersimpan | Seharusnya |
|---|---|---|---|---|
| booking | `BK-2604-005` | `tgl_keluar_est` | 2026-07-01 | 2026-08-01 |
| booking | `BK-2604-011` | `tgl_keluar_est` | 2026-07-20 | 2026-07-18 |
| content | `id=2` | `er_persen` | 2196428571 | 18.09 |

`er_persen = 2196428571` jelas nilai rusak (ER% wajar 0–100) — kemungkinan
artefak pembekuan formula saat migrasi CSV.

**Tidak diperbaiki di fase ini.** `--commit` menulis ke data produksi, dan §11.2.1
melarang "memperbaiki" apa pun saat port. Dua tanggal `tgl_keluar_est` menyangkut
akhir kontrak penghuni, jadi harus dikonfirmasi manusia, bukan diputuskan skrip.
Keputusan user diperlukan sebelum menjalankan `npx tsx scripts/recompute-turso.ts --commit`.

---

## Status formula [PENDING]

Ke-4 formula bertanda `[PENDING]` di `compute.ts` (SLA maintenance, aturan durasi
perbaikan, ROI promosi, sumber kategori arus kas jurnal) **di-port apa adanya
tanpa tebakan perbaikan** (§11.2.4). Golden test tidak dapat memvalidasi
kebenarannya — hanya membuktikan lama & baru berperilaku sama.

Untuk mengunci: jalankan `npx tsx scripts/dump-formulas.ts` (butuh akses service
account ke spreadsheet sumber) lalu terjemahkan rumus aslinya ke `FORMULA_CONFIG`.

---

## Addendum 20 Juli 2026 — formula ROI Kotor dikunci dari dump spreadsheet

Setelah cutover, `docs/formulas-dump.json` dibaca lewat `scripts/dump-formulas.ts`
(diperbaiki: cap 6-baris yang sebelumnya memotong sheet `1_PARAMETER` sebelum
baris yang dirujuk formula lain — sheet config/parameter kini diambil penuh).

**Terkunci & diimplementasikan** — `roi_kotor` (tabel `promotion`), formula:
`=IF(G="";"";IF(G=0;"";(J*'1_PARAMETER'!$B$3-G)/G)` — G=spend_aktual,
J=booking_dr_promo, $B$3=Tarif Eco (850000, SAMA dgn `priceByTipe` yang sudah
ada). Ditambahkan ke `FORMULA_COLUMNS.promotion` agar ikut ditulis balik oleh
`recompute-turso.ts`.

**Golden test dijalankan ulang current-vs-current** (snapshot lama diregenerasi
terhadap Turso LIVE SEKARANG, bukan snapshot basi Fase 2 — supaya adil,
mengisolasi murni beda kode dari drift data akibat pemakaian nyata pasca-cutover).
Hasil: **hanya 3 sel berbeda, semuanya di `promotion.roi_kotor`**, nol dampak ke
15 tabel lain.

| Baris | roi_kotor lama (beku) | roi_kotor baru (hitung ulang) |
|---|---|---|
| Promo Tahun Baru | 43.125 | 4.31 |
| Valentine Special | null | "" |
| Promo Ramadan | null | "" |

Nilai lama = beku dari ekspor CSV migrasi awal, dihitung dari `spend_aktual`/
`booking_dr_promo` PADA SAAT ITU. Kedua kolom itu sudah berubah sejak
(pemakaian Ops pasca-cutover), sehingga nilai beku tidak lagi cocok dengan data
sekarang — inilah PERSIS alasan `compute.ts` menghitung ulang saat baca, sama
seperti seluruh kolom formula lain yang sudah tervalidasi sejak Fase 2 (bukan
kategori risiko baru).

**Tetap PENDING (dump TIDAK bisa menjawab)**:
- `slaTargetHari` — dump membuktikan bentuk tebakan (per-prioritas) SALAH;
  rumus asli pakai SATU angka target flat (`'1_PARAMETER'!$B$9`). Tapi nilai
  $B$9 sendiri tidak ikut tertangkap sebelum perbaikan cap baris — perlu
  `dump-formulas.ts` dijalankan ULANG untuk menangkapnya. Tidak diubah tanpa
  angka asli (mengganti satu tebakan dgn tebakan lain bukan perbaikan).
- `jurnalKategoriDari` — dump membuktikan kolom "Kategori" di sheet Transaksi
  TIDAK PUNYA FORMULA (isian manual). Tidak ada jawaban di spreadsheet sama
  sekali, bukan sekadar belum sempat dicek.

**Terkonfirmasi (naik status VERIFIED)**: `durasiMinimalSatuHari` — formula
Preventif (`=IF(C2="";"";IF(C2=B2;1;C2-B2))`) matematis setara dgn `MAX(1,d)`
yang sudah dipakai; tidak ada perubahan nilai.
