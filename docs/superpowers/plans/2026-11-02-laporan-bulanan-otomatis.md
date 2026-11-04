# Laporan Bulanan Otomatis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghasilkan 11 laporan bulanan (PDF) dari Turso dengan susunan dan tampilan sama dengan contoh di Drive, lewat tombol, pilihan periode, dan jadwal otomatis tanggal 1.

**Architecture:** Setiap laporan = *builder* (query Turso, lalu fungsi murni yang menyusun data) + *template* (fungsi murni data → HTML) + entri di *registry*. HTML dirender jadi PDF dengan `htmlKePdf` yang sudah ada, diarsipkan ke Drive, dicatat di `laporan_riwayat`. Fungsi murni diuji dengan `node:test`; query Turso diperiksa dengan skrip `tsx`.

**Tech Stack:** Next.js 16, TypeScript, `@libsql/client` (Turso), `puppeteer-core` (PDF), `googleapis` (Drive), `node:test` via `npx tsx --test`, Vercel cron.

**Spec:** `docs/superpowers/specs/2026-11-02-laporan-otomatis-design.md`

**Cakupan:** Plan ini mencakup spec tahap 1, 2, 3, dan 5, serta Kinerja Admin dengan bagian Pelanggaran dan Kecelakaan Kerja tampil kosong. **Tabel + form input Pelanggaran/Kecelakaan Kerja (spec tahap 4) adalah plan terpisah**: kolom dan siapa yang menginput perlu keputusan dulu. Tugas 8 menyiapkan titik sambungnya.

## Global Constraints

- Satu tata letak, teks, dan urutan bagian **persis** seperti contoh Drive (spec §2). Label di test disalin verbatim dari spec.
- Format uang `Rp1.234.000` (tanpa spasi), negatif `-Rp175.000`. **Jangan pakai `rp()` dari `src/lib/laporan/template.ts`** (formatnya `Rp 1.234`, berbeda).
- Tanggal `dd/mm/yyyy`; waktu pembuatan `dd/mm/yyyy hh:mm` untuk laporan Kinerja dan Operasional, hanya tanggal untuk Pekerjaan; zona waktu `Asia/Jakarta`.
- Bulan tanpa data tetap menghasilkan dokumen berstruktur penuh dengan teks `(tidak ada data pada periode ini)` (Pekerjaan) atau `Tidak ada {x} pada periode ini.` (lainnya). Tidak boleh melempar error.
- Teks dari database **wajib di-escape HTML**.
- Format keluaran hanya PDF. Properti A saja. Tidak ada dependensi baru.
- Migrasi memakai nomor berikutnya (`019_*.sql`) dan diterapkan dengan `scripts/apply-schema.ts` (dry-run dulu, lalu `--commit`).
- Hak akses: peran `owner`, `staff_admin`, `staff_sales` (set `ALLOWED` yang sama dengan modul laporan keuangan); Owner Review hanya `owner`.
- Data uji memakai nama samaran, bukan data penghuni nyata. Tidak ada data nyata di repo.
- Komentar kode minimal; jelaskan hanya bagian tak umum.
- Repo ini bukan repositori git saat rencana ditulis; langkah "Commit" berlaku bila `git init` sudah dilakukan, kalau tidak lewati dan catat file yang berubah.

## Review Focus

1. **Bulan kosong** (mis. Oktober 2026): semua 11 laporan harus tetap utuh dengan pesan kosong, angka 0, `0%` (bukan `NaN%`). Test di Tugas 1, 2, 4, 5.
2. **Teks berisi `<`, `&`, `"`** (nama tugas, deskripsi feedback): harus ter-escape, PDF tidak rusak dan tidak ada injeksi HTML. Test di Tugas 1.
3. **Batas periode**: Februari kabisat (2028-02 berakhir tanggal 29), tugas bertanggal 31 jam 23:59, periode tidak valid (`2026-13`, `abcd`) ditolak 400, periode di masa depan ditolak. Test di Tugas 1 dan 3.
4. **Cron ganda atau gagal sebagian**: jalan dua kali tidak membuat duplikat; satu laporan gagal tidak menghentikan sisanya; tanpa `CRON_SECRET` yang benar ditolak 401. Test di Tugas 9.
5. **Angka keuangan beda dari Laba Rugi resmi**: Kinerja Keuangan dan Owner harus memakai fungsi `buildLabaRugi`/`buildArusKas` yang sama, bukan hitung ulang. Test di Tugas 5.

---

## File Structure

```
src/lib/laporan-bulanan/
  periode.ts        parsePeriode, periodeSebelumnya
  format.ts         rupiah, tglPendek, tglPanjang, waktuWib, esc
  shell.ts          CSS + kerangka HTML bersama (tema "dokumen" dan tema "owner")
  tugas.ts          petaStatus, ringkasTugas, lewatDeadline (murni)
  types.ts          tipe bersama
  builders/         pekerjaan.ts, operasional.ts, owner.ts, keuangan.ts, sales.ts, marketing.ts, admin.ts
  templates/        pekerjaan.ts, kerja-operasional.ts, kinerja-*.ts, owner.ts
  registry.ts       daftar LaporanDef + generateLaporan
  *.test.ts         uji fungsi murni (node:test)
src/app/api/ops/admin/laporan-bulanan/route.ts        GET daftar+riwayat, POST generate
src/app/api/ops/admin/laporan-bulanan/pdf/route.ts    GET pdf/pratinjau
src/app/api/cron/laporan-bulanan/route.ts             cron
src/components/LaporanBulananPanel.tsx
db/schema/019_laporan_riwayat_jenis_bebas.sql
scripts/laporan-bulanan-check.ts
```

---

### Task 1: Fondasi (periode, format, kerangka HTML, logika tugas)

**Files:**
- Create: `src/lib/laporan-bulanan/{periode,format,shell,tugas,types}.ts`
- Test: `src/lib/laporan-bulanan/periode.test.ts`, `format.test.ts`, `tugas.test.ts`

**Interfaces:**
- Produces:
  - `interface Periode { kode: string; dari: string; sampai: string; label: string }` (`kode` `'2026-10'`, `dari` `'2026-10-01'`, `sampai` `'2026-10-31'`, `label` `'Oktober 2026'`)
  - `parsePeriode(kode: string, sekarang?: Date): Periode` melempar `Error('Periode tidak valid.')` bila format salah atau bulan setelah bulan `sekarang`
  - `periodeSebelumnya(sekarang: Date): Periode` (zona Jakarta)
  - `rupiah(n: number): string`, `tglPendek(iso: string): string`, `tglPanjang(iso: string): string`, `waktuWib(d: Date, denganJam: boolean): string`, `esc(s: unknown): string`
  - `type StatusTugas = 'Selesai' | 'Proses' | 'Tertunda'`, `petaStatus(s: 'Pending'|'In Progress'|'Complete'): StatusTugas`
  - `ringkasTugas(rows: { status: StatusTugas }[]): { total: number; selesai: number; proses: number; tertunda: number; persen: number }`
  - `lewatDeadline(t: { status: string; deadline: string | null }, dibuatIso: string): boolean` (benar bila status bukan `Selesai`/`Complete` dan deadline lebih awal dari tanggal dibuat)
  - `kerangkaDokumen(isi: string, tema: 'dokumen' | 'owner'): string` (HTML lengkap A4 dengan CSS)

- [ ] **Step 1: Tulis test gagal untuk periode**

```ts
test('Februari kabisat berakhir 29', () => {
  assert.equal(parsePeriode('2028-02', new Date('2028-03-05')).sampai, '2028-02-29');
});
test('label Indonesia', () => {
  assert.equal(parsePeriode('2026-10', new Date('2026-11-02')).label, 'Oktober 2026');
});
test('menolak format salah dan masa depan', () => {
  for (const k of ['2026-13', 'abcd', '2026-1', '2099-01']) assert.throws(() => parsePeriode(k, new Date('2026-11-02')));
});
test('periodeSebelumnya dari 1 November 2026 = 2026-10', () => {
  assert.equal(periodeSebelumnya(new Date('2026-11-01T01:00:00Z')).kode, '2026-10');
});
test('periodeSebelumnya dari 1 Januari = Desember tahun lalu', () => {
  assert.equal(periodeSebelumnya(new Date('2027-01-01T01:00:00Z')).kode, '2026-12');
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx tsx --test src/lib/laporan-bulanan/periode.test.ts`
Expected: FAIL (modul belum ada)

- [ ] **Step 3: Implementasi `periode.ts`**

Hitung hari terakhir dengan `Date.UTC(y, m, 0)` (bukan `new Date(y, m, 0).toISOString()` seperti di `laporan-check.ts`, itu rawan geser zona waktu). Bulan "sekarang" dihitung dengan `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })`. Nama bulan: array 12 nama penuh.

- [ ] **Step 4: Test gagal untuk format dan tugas, lalu implementasi**

```ts
assert.equal(rupiah(30550000), 'Rp30.550.000');
assert.equal(rupiah(-175000), '-Rp175.000');
assert.equal(rupiah(0), 'Rp0');
assert.equal(tglPendek('2026-06-22'), '22/06/2026');
assert.equal(tglPanjang('2026-06-01'), '1 Juni 2026');
assert.equal(waktuWib(new Date('2026-07-05T10:30:00Z'), true), '05/07/2026 17:30');
assert.equal(esc('<b>"A&B"</b>'), '&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;');
assert.equal(esc(null), '');
assert.deepEqual(ringkasTugas([]), { total: 0, selesai: 0, proses: 0, tertunda: 0, persen: 0 });
assert.equal(ringkasTugas([{status:'Selesai'},{status:'Proses'},{status:'Tertunda'}]).persen, 33);
assert.equal(petaStatus('Complete'), 'Selesai');
assert.equal(lewatDeadline({ status: 'Pending', deadline: '2026-06-25' }, '2026-07-06'), true);
assert.equal(lewatDeadline({ status: 'Complete', deadline: '2026-06-25' }, '2026-07-06'), false);
assert.equal(lewatDeadline({ status: 'Pending', deadline: null }, '2026-07-06'), false);
```
Run: `npx tsx --test src/lib/laporan-bulanan/*.test.ts` → mula-mula FAIL, setelah implementasi PASS.

- [ ] **Step 5: Implementasi `shell.ts`**

Tema `dokumen`: Arial 11 pt, margin 72 pt, A4, tabel border hitam 1 pt, sel header `#d9e2f3`. Tema `owner`: font Poppins (judul) dan Lato (isi) **tertanam sebagai data URI** (ikuti `src/lib/invoice/fonts` dan `cssFont()` di `pdf.ts`; bila Poppins/Lato belum ada di folder itu, tambahkan file font ke sana), margin 54 pt, palet `#9e2227`/`#c92d31`/`#f8e9e9`/`#e3d9d7`/`#33302f`. Tidak ada request jaringan saat render.

- [ ] **Step 6: Jalankan semua test, commit**

Run: `npx tsx --test src/lib/laporan-bulanan/*.test.ts` → PASS
Commit: `feat(laporan-bulanan): fondasi periode, format, kerangka HTML`

---

### Task 2: Laporan Pekerjaan Bulanan (Admin, Keuangan, Marketing, Sales)

**Files:**
- Create: `src/lib/laporan-bulanan/builders/pekerjaan.ts`, `templates/pekerjaan.ts`
- Test: `src/lib/laporan-bulanan/templates/pekerjaan.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Periode`, `ringkasTugas`, `petaStatus`, `esc`, `tglPendek`, `waktuWib`, `kerangkaDokumen`)
- Produces:
  - `type DivisiPekerjaan = 'Admin' | 'Keuangan' | 'Marketing' | 'Sales'`
  - `interface DataPekerjaan { divisi: DivisiPekerjaan; periode: Periode; dibuat: Date; rows: { tanggal: string; pekerjaan: string; pic: string; deadline: string | null; status: StatusTugas }[] }`
  - `susunPekerjaan(divisi, periode, dibuat, rowsDb: DailyTaskRow[]): DataPekerjaan` (murni; memetakan `Finance`→`Keuangan`, status lewat `petaStatus`)
  - `ambilPekerjaan(divisi: DivisiPekerjaan, periode: Periode): Promise<DailyTaskRow[]>` (query `daily_tasks` WHERE `divisi = ?` (nilai DB: `Admin`, `Finance`, `Marketing`, `Sales`) AND `tanggal BETWEEN dari AND sampai` ORDER BY `tanggal, id`)
  - `htmlPekerjaan(d: DataPekerjaan): string`

Catatan: sumber adalah `daily_tasks` (ditulis modul `daily-task.ts`; statusnya `Pending/In Progress/Complete` cocok dengan contoh). Bidang di tabel rincian = nama divisi.

- [ ] **Step 1: Test gagal** (data samaran: divisi Admin, periode `2026-06`, 3 tugas Selesai/Proses/Tertunda)

Assert pada HTML: memuat berurutan `LAPORAN PEKERJAAN BULANAN`, `DIVISI ADMIN — KOST TIGA DARA`, `Periode: Juni 2026`, `Tanggal dibuat: 05/07/2026`, `A. RINGKASAN`, `Total Pekerjaan`, `Persentase Selesai`, `33%`, `B. RINCIAN PEKERJAAN`, header `No`, `Tanggal`, `Pekerjaan`, `Bidang`, `PIC`, `Deadline`, `Status`, `C. CATATAN / KENDALA`, `Dibuat oleh,`, `Staf ADMIN`, `Disetujui oleh,`, `Pengelola`. Test kedua: `rows: []` memuat `(tidak ada data pada periode ini)` dan `0%`, tidak memuat `NaN`. Test ketiga: `pekerjaan: '<script>x</script>'` tidak muncul mentah. Test keempat: `susunPekerjaan('Keuangan', …)` dengan baris `divisi:'Finance'` menghasilkan `bidang` `Keuangan` dan tanda tangan `Staf KEUANGAN`.

- [ ] **Step 2: Jalankan, pastikan gagal.** Run: `npx tsx --test src/lib/laporan-bulanan/templates/pekerjaan.test.ts` → FAIL

- [ ] **Step 3: Implementasi builder dan template** sesuai Interfaces. Dua baris titik-titik di bagian C persis 85 titik per baris seperti contoh.

- [ ] **Step 4: Jalankan test → PASS. Commit:** `feat(laporan-bulanan): template dan builder laporan pekerjaan divisi`

---

### Task 3: Registry, migrasi riwayat, API, arsip Drive

**Files:**
- Create: `src/lib/laporan-bulanan/registry.ts`, `db/schema/019_laporan_riwayat_jenis_bebas.sql`, `src/app/api/ops/admin/laporan-bulanan/route.ts`, `src/app/api/ops/admin/laporan-bulanan/pdf/route.ts`
- Modify: `src/lib/invoice/arsip.ts` (`arsipkanLaporan` terima parameter ketiga `folderId?: string`, default tetap `process.env.DRIVE_FOLDER_LAPORAN`)
- Test: `src/lib/laporan-bulanan/registry.test.ts`

**Interfaces:**
- Consumes: Task 1, 2
- Produces:
  - `interface LaporanDef { id: string; keluarga: 'kerja' | 'kinerja' | 'owner'; judul: string; ownerOnly?: boolean; render(periode: Periode, dibuat: Date): Promise<string>; namaFile(periode: Periode): string }`
  - `LAPORAN: LaporanDef[]` dan `cariLaporan(id: string): LaporanDef | undefined`
  - `generateLaporan(id: string, kode: string, oleh: string): Promise<{ namaFile: string; pdf: Buffer; driveUrl?: string; riwayatId: number }>`
  - `laporanSudahAda(id: string, kode: string): Promise<boolean>` (dipakai cron)
  - id registri: `kerja-admin`, `kerja-keuangan`, `kerja-marketing`, `kerja-sales`, `kerja-operasional`, `kinerja-admin`, `kinerja-keuangan`, `kinerja-marketing`, `kinerja-operasional`, `kinerja-sales`, `owner-review`
  - nama berkas mengikuti judul di Drive, mis. `Laporan ADMIN - Juni 2026.pdf`, `Laporan Kerja Divisi Operasional - Juni 2026.pdf`, `Laporan Kinerja Admin - Juni 2026.pdf`, `Laporan Owner Review - Juni 2026.pdf`
  - kunci `app_config` folder Drive: `drive_folder_laporan_{id}`; kosong → pakai `DRIVE_FOLDER_LAPORAN`

- [ ] **Step 1: Test gagal registry**: id unik; `cariLaporan('kerja-admin')?.namaFile(parsePeriode('2026-06', …))` sama dengan `Laporan ADMIN - Juni 2026.pdf`; hanya `owner-review` bertanda `ownerOnly`.

- [ ] **Step 2: Migrasi 019.** `laporan_riwayat.jenis` memakai CHECK tiga nilai sehingga tidak bisa menampung id baru. SQLite tidak bisa mengubah CHECK: buat `laporan_riwayat_new` tanpa CHECK pada `jenis`, salin semua baris, hapus tabel lama, ganti nama. Tambah indeks `(jenis, periode)`.
  Jalankan: `npx tsx scripts/apply-schema.ts db/schema/019_laporan_riwayat_jenis_bebas.sql` (dry-run, baca hasil), lalu `--commit`. Verifikasi: `SELECT COUNT(*) FROM laporan_riwayat` sama dengan sebelum migrasi, dan route lama laporan keuangan masih bisa mencatat `LabaRugi`.

- [ ] **Step 3: Implementasi registry** dengan 4 entri `kerja-*` dari Tugas 2; sisanya ditambah tugas berikutnya. `generateLaporan` memanggil `render`, `htmlKePdf`, `arsipkanLaporan`, lalu `INSERT INTO laporan_riwayat (periode, jenis, nama_file, drive_url, dibuat_oleh)`.

- [ ] **Step 4: API.** Pola sama dengan `api/ops/admin/laporan-keuangan` (`getSessionUser`, set `ALLOWED`).
  - `GET /api/ops/admin/laporan-bulanan` → `{ laporan: [{id, judul, keluarga}], riwayat }` (daftar sesuai peran; riwayat 50 terakhir yang `jenis` ada di registri)
  - `POST` body `{ id, periode }` → generate; 400 untuk id atau periode tidak valid (pesan dari `parsePeriode`), 403 bila `ownerOnly` dan peran bukan owner
  - `GET /api/ops/admin/laporan-bulanan/pdf?id=&periode=&format=pdf|html` → regenerasi di tempat (tidak tergantung Drive). `format=html` untuk pratinjau.

- [ ] **Step 5: Verifikasi.** Run: `npx tsc --noEmit` → tanpa error. Run dev server, login owner, panggil `GET .../pdf?id=kerja-admin&periode=2026-06` → PDF terunduh; `periode=2026-13` → 400; `periode=2099-01` → 400.

- [ ] **Step 6: Commit:** `feat(laporan-bulanan): registry, API, migrasi riwayat, arsip Drive`

---

### Task 4: Panel UI

**Files:**
- Create: `src/components/LaporanBulananPanel.tsx`
- Modify: `src/app/(ops)/ops/admin/laporan-keuangan/page.tsx` (tampilkan panel baru di bawah `LaporanKeuanganPanel`; ubah judul halaman jadi "Laporan"; pemeriksaan peran tidak berubah)

**Interfaces:**
- Consumes: API Task 3.
- Produces: komponen klien `LaporanBulananPanel()` tanpa props.

- [ ] **Step 1: Implementasi.** Pemilih bulan (`<input type="month">`, bawaan bulan lalu, maksimum bulan ini), daftar laporan dikelompokkan per keluarga, tiap baris punya tombol **Pratinjau** (membuka `format=html` di tab baru), **Unduh PDF**, **Generate & Arsipkan**. Tabel riwayat dengan tautan Drive bila ada. Ikuti kelas dan gaya `LaporanKeuanganPanel.tsx` (skeleton, `card`). Teks tombol dan pesan dalam bahasa Indonesia. Status memuat dan galat ditampilkan, tombol dinonaktifkan selama proses.

- [ ] **Step 2: Verifikasi di browser.** Jalankan dev server, buka halaman, pilih Juni 2026, klik Pratinjau Admin → dokumen tampil; Generate → baris baru di riwayat. Periksa console tanpa error. Cek lebar ponsel (375 px) tidak melimpah horizontal.

- [ ] **Step 3: Commit:** `feat(laporan-bulanan): panel UI generate, pratinjau, riwayat`

---

### Task 5: Owner Review

**Files:**
- Create: `builders/owner.ts`, `templates/owner.ts`
- Test: `templates/owner.test.ts`
- Modify: `registry.ts` (daftarkan `owner-review`, `ownerOnly: true`)

**Interfaces:**
- Consumes: Task 1; `buildLabaRugi`, `buildArusKas` dari `src/lib/laporan/generator.ts`
- Produces:
  - `interface DataOwner { periode: Periode; dibuat: Date; masuk: { nama: string; kamar: string; institusi: string; tglMasuk: string }[]; keluar: { nama: string; kamar: string; tglKeluar: string }[]; keuangan: { pendapatan: number; beban: number; laba: number; kasMasuk: number; kasKeluar: number; arusBersih: number; transaksi: { tanggal: string; keterangan: string; debit: string; kredit: string; nominal: number }[] }; operasional: { korektifSelesai: number; preventifSelesai: number; inspeksi: number; darurat: number; biaya: number; rincian: { tanggal: string; jenis: string; item: string; biaya: number; status: string }[] }; marketing: { leads: number; booking: number }; rekomendasi: string[] }`
  - `ambilOwner(periode: Periode): Promise<DataOwner>` dan `htmlOwner(d: DataOwner): string`
  - `susunRekomendasi(d: Omit<DataOwner, 'rekomendasi'>): string[]` (murni)

Sumber: penghuni masuk dari `occupancy_history.tanggal_mulai` dalam periode (institusi dari data penghuni; **cek nama kolom institusi di `active_tenant` saat implementasi**), penghuni keluar dari `checkout_log.tanggal_checkout`, keuangan dari `buildLabaRugi`/`buildArusKas` plus `jurnal_transaksi` untuk rincian, operasional dari `maintenance_pm`/`maintenance_cm`/`inspeksi_fasilitas`, marketing dari `leads`/`booking`.

- [ ] **Step 1: Test gagal.** Assert HTML memuat berurutan: `KOST TIGA DARA PUTRI UGM`, `Laporan Owner Review Bulanan`, `Periode: Juni 2026`, `1. Ringkasan Eksekutif`, `2. Hunian & Penyewa`, `Penghuni Baru Masuk — Juni 2026`, `Penghuni Keluar — Juni 2026`, `3. Keuangan — Juni 2026`, `Rincian Transaksi pada Periode`, `4. Operasional: Inspeksi, Perawatan & Perbaikan — Juni 2026`, `5. Marketing — Juni 2026`, `6. Kualitas Data & Rekomendasi`, `Laporan otomatis · Kost Tiga Dara Putri UGM · Hanya memuat data dalam periode laporan.` Test kosong: `masuk: []` → `Tidak ada penghuni baru tercatat pada periode ini.`; `keluar: []` → `Tidak ada penghuni keluar tercatat pada periode ini.`; marketing 0 → `Tidak ada data leads marketing pada periode ini.`; angka bersih negatif tampil `-Rp175.000`. Test `susunRekomendasi`: tanpa inspeksi → memuat saran inspeksi; dengan inspeksi → tidak memuat; bila `keuangan.transaksi` kosong → saran input penerimaan sewa.

- [ ] **Step 2: Jalankan → FAIL. Step 3: Implementasi.** Daftar "Kualitas Data & Rekomendasi" dihasilkan `susunRekomendasi`, bukan teks tetap. Kalimat Ringkasan Eksekutif mengikuti contoh Drive: `Penghuni baru masuk bulan ini: N orang.`, `Pendapatan diakui ({Bulan Tahun}): …`, `Beban tercatat: … · Laba bersih: …`, `Arus kas bersih: …`, `Pemeliharaan: N pekerjaan, biaya …, darurat N.`, `Leads marketing: N (booking N).`

- [ ] **Step 4: Test → PASS.** Lalu verifikasi data nyata: `npx tsx scripts/laporan-bulanan-check.ts owner-review 2026-06` (skrip dibuat di Tugas 10; sementara cukup jalankan `ambilOwner` lewat skrip sekali pakai) dan cocokkan angka dengan keluaran `npx tsx scripts/laporan-check.ts 2026-06` (pendapatan, beban, kas). Catat selisih bila ada.

- [ ] **Step 5: Commit:** `feat(laporan-bulanan): owner review dengan penghuni keluar dari checkout_log`

---

### Task 6: Kinerja Keuangan dan Kinerja Sales

**Files:**
- Create: `builders/keuangan.ts`, `builders/sales.ts`, `templates/kinerja-keuangan.ts`, `templates/kinerja-sales.ts`
- Test: `templates/kinerja-keuangan.test.ts`, `templates/kinerja-sales.test.ts`
- Modify: `registry.ts`

**Interfaces:**
- Consumes: Task 1, 5 (pola `DataOwner.keuangan`)
- Produces:
  - `interface DataKinerjaKeuangan { periode; dibuat: Date; kasMasuk: number; kasKeluar: number; arusBersih: number; jumlahTransaksi: number; pendapatan: number; beban: number; laba: number; perKategori: { kategori: string; total: number }[]; transaksi: { tanggal: string; debit: string; kredit: string; nominal: number; keterangan: string }[] }`
  - `interface DataKinerjaSales { periode; dibuat: Date; checkIn: number; konfirmasi: number; batal: number; nilaiBooking: number; sumberTeratas: string; booking: { tanggal: string; nama: string; kamar: string; status: string; harga: number; sumber: string }[]; survey: { total: number; tertarik: number; konversiPersen: number } }`
  - `ambilKinerjaKeuangan(p)`, `ambilKinerjaSales(p)`, `htmlKinerjaKeuangan(d)`, `htmlKinerjaSales(d)`
  - `ambilKinerjaKeuangan` memakai `buildLabaRugi`/`buildArusKas` untuk semua angka ringkasan; `transaksi` dari `jurnal_transaksi` dalam periode.

- [ ] **Step 1: Test gagal Keuangan.** Header `LAPORAN KINERJA KEUANGAN`, `Kost Tiga Dara Putri UGM`, `Periode: Juni 2026   |   Dibuat: 05/07/2026 14:15`; bagian `A. Kinerja Arus Kas — Juni 2026` (`Kas Masuk`, `Kas Keluar`, `Arus Kas Bersih`, `Jumlah Transaksi`), `B. Kinerja Laba/Rugi (berbasis pengakuan)` (`Pendapatan`, `Beban`, `Laba / (Rugi) Bulan Ini`), `C. Pengeluaran per Kategori`, `D. Rincian Transaksi` (header `Tgl`, `Debit`, `Kredit`, `Nominal`, `Keterangan`), catatan pembuka tentang laporan akuntansi formal, tanda tangan `Staf Divisi` / `Mengetahui,` `Pengelola Kost`. Test rugi: laba negatif tampil `-Rp…`. Test kosong: `transaksi: []` tetap menampilkan header tabel D dan `Tidak ada transaksi pada periode ini.`.

- [ ] **Step 2: Test gagal Sales.** `LAPORAN KINERJA SALES`, `A. Aktivitas Booking — Juni 2026` (`Booking Check-in`, `Booking Konfirmasi`, `Booking Dibatalkan`, `Nilai Booking (non-batal)`, `Sumber Leads Teratas`, header `Tgl`, `Nama`, `Kamar`, `Status`, `Harga`, `Sumber`), `B. Aktivitas Survey / Leads — Juni 2026` (`Total Survey`, `Tertarik / Lanjut`, `Konversi Minat`). Kosong: `Tidak ada booking pada periode ini.` dan `Tidak ada survey pada periode ini.`, `0%`.

- [ ] **Step 3: Jalankan → FAIL. Step 4: Implementasi.** Mapping `booking.status_booking` ke label `Check-in`/`Konfirmasi`/`Dibatalkan`: **baca nilai status yang benar-benar ada** lewat `SELECT DISTINCT status_booking FROM booking` dan `SELECT DISTINCT hasil_survey FROM survey` sebelum menulis pemetaan; jangan menebak.

- [ ] **Step 5: Test → PASS. Verifikasi paritas:** `kasMasuk`/`kasKeluar`/`laba` Juni 2026 sama dengan `scripts/laporan-check.ts 2026-06`. Commit: `feat(laporan-bulanan): kinerja keuangan dan sales`

---

### Task 7: Kinerja Marketing

**Files:**
- Create: `builders/marketing.ts`, `templates/kinerja-marketing.ts`
- Test: `templates/kinerja-marketing.test.ts`
- Modify: `registry.ts`

**Interfaces:**
- Consumes: Task 1
- Produces:
  - `interface DataKinerjaMarketing { periode; dibuat: Date; leads: { total: number; sumberTeratas: string; statusRingkas: string }; konten: { post: number; reach: number; likes: number; komentar: number; shareSaves: number; engagementPersen: number; platformTeraktif: string }; kampanye: { jumlah: number; budget: number; spend: number; targetLeads: number; leadsAktual: number; capaianPersen: number; bookingDariPromo: number } }`
  - `ambilKinerjaMarketing(p)`, `htmlKinerjaMarketing(d)`

- [ ] **Step 1: Test gagal.** `LAPORAN KINERJA MARKETING`; `A. Akuisisi Leads — Juni 2026` (`Total Leads Masuk`, `Sumber Teratas`, `Status Leads`); `B. Kinerja Konten Sosial Media` (`Jumlah Post`, `Total Reach`, `Total Likes`, `Total Komentar`, `Total Share/Saves`, `Engagement Rate`, `Platform Teraktif`); `C. Kinerja Kampanye / Promosi` (`Jumlah Kampanye`, `Total Budget`, `Total Spend Aktual`, `Target Leads`, `Leads Aktual`, `Capaian Target`, `Booking dari Promo`). Kosong: `Tidak ada leads pada periode ini.`, `Tidak ada konten pada periode ini.`, `Tidak ada kampanye pada periode ini.`, semua angka `0`/`Rp0`/`0%`. Test pembagi nol: `targetLeads: 0` → `capaianPersen` 0.

- [ ] **Step 2: FAIL → Step 3: implementasi.** Sumber `leads` (tanggal), `content` (`tgl_post`; `engagement`/`er_persen` sudah ada, rata-ratakan atau hitung `(likes+komentar+share)/reach`; **cek rumus di `er_persen` dulu dan pakai yang sama**), `promotion` (`tgl_mulai`..`tgl_selesai` yang beririsan dengan periode). Kolom tanggal di tabel ini mungkin bertipe teks bukan ISO: cek isinya dulu (`SELECT tgl_post FROM content LIMIT 5`) dan normalkan di builder.

- [ ] **Step 4: Test → PASS. Commit:** `feat(laporan-bulanan): kinerja marketing`

---

### Task 8: Operasional (Kerja hitung-tugas dan Kinerja kaya) dan Kinerja Admin

**Files:**
- Create: `builders/operasional.ts`, `builders/admin.ts`, `templates/kerja-operasional.ts`, `templates/kinerja-operasional.ts`, `templates/kinerja-admin.ts`
- Test: `templates/kerja-operasional.test.ts`, `kinerja-operasional.test.ts`, `kinerja-admin.test.ts`
- Modify: `registry.ts`

**Interfaces:**
- Consumes: Task 1 (`ringkasTugas`, `lewatDeadline`), `daily_tasks`
- Produces:
  - `interface DataKerjaOperasional { periode; dibuat: Date; sub: { nama: 'Maintenance' | 'Inspeksi' | 'Kebersihan'; tugas: { tanggal: string; task: string; pic: string; deadline: string | null; status: 'Pending' | 'In Progress' | 'Complete' }[] }[] }`
  - `interface DataKinerjaOperasional { periode; dibuat: Date; inspeksi: { total: number; perluTindakLanjut: number }; preventif: { total: number; selesai: number; belum: number; biaya: number; rows: { tgl: string; fasilitas: string; jenis: string; prioritas: string; biaya: number; status: string }[] }; korektif: { total: number; selesai: number; belum: number; darurat: number; rataDurasiHari: number; biaya: number; rows: { tgl: string; lokasi: string; kerusakan: string; prioritas: string; biaya: number; status: string }[] }; totalBiaya: number }`
  - `interface DataKinerjaAdmin { periode; dibuat: Date; feedback: { total: number; selesai: number; proses: number; biaya: number; kategori: string }; pelanggaran: { total: number; jenis: string }; kecelakaan: { total: number; lokasi: string }; lampiran: { feedback: string[][]; pelanggaran: string[][]; kecelakaan: string[][] } }`
  - `ambilPelanggaran(p)` dan `ambilKecelakaan(p)` **mengembalikan `[]` dulu** (titik sambung untuk plan terpisah tabel Pelanggaran/Kecelakaan; ganti isi fungsi saja, template tidak berubah)
  - builder dan template masing-masing: `ambilKerjaOperasional`, `htmlKerjaOperasional`, `ambilKinerjaOperasional`, `htmlKinerjaOperasional`, `ambilKinerjaAdmin`, `htmlKinerjaAdmin`

- [ ] **Step 1: Test gagal Kerja Operasional (gaya hitung tugas).** `LAPORAN KERJA DIVISI OPERASIONAL`, `Kost Tiga Dara Putri UGM`, `Lingkup: Maintenance, Inspeksi, Kebersihan   |   Periode: Juni 2026   |   Dibuat: 06/07/2026 15:03`, `Ringkasan Eksekutif` dengan header `Divisi`, `Total Task`, `Complete`, `In Progress`, `Pending`, `Lewat Deadline`, baris `Maintenance`, `Inspeksi`, `Kebersihan`, `TOTAL`; `Tingkat penyelesaian gabungan: 44% (4 dari 9 task).`; bagian `A. Divisi Maintenance`, `B. Divisi Inspeksi`, `C. Divisi Kebersihan` masing-masing dengan `Lewat Deadline (belum complete)`. Status ditampilkan dalam bahasa Inggris seperti contoh (keputusan builder: ikuti contoh persis; spec §6 menyebut satu bahasa tetapi pengguna meminta "gaya hitung tugas"). Kosong: `Tidak ada task tercatat pada periode ini.` per sub-divisi dan `Tingkat penyelesaian gabungan: 0% (0 dari 0 task).`. Pemetaan divisi DB → sub: `Maintenance`→Maintenance, `Inspeksi`→Inspeksi, `Cleaning`→Kebersihan.

- [ ] **Step 2: Test gagal Kinerja Operasional (gaya kaya, susunan folder 2).** `LAPORAN KINERJA OPERASIONAL (INSPEKSI & MAINTENANCE)`, `A. Inspeksi Harian — Juni 2026` (`Total Inspeksi Dilakukan`, `Temuan Perlu Tindak Lanjut`), `B. Perawatan (Preventif)` (`Total Kegiatan Perawatan`, `Selesai`, `Proses/Tertunda`, `Total Biaya Perawatan`; tabel `Tgl`, `Fasilitas`, `Jenis`, `Prioritas`, `Biaya`, `Status`), `C. Perbaikan (Korektif)` (`Total Laporan Kerusakan`, `Perbaikan Selesai`, `Proses/Tertunda`, `Prioritas Darurat`, `Rata-rata Durasi Perbaikan (hari)`, `Total Biaya Perbaikan`; tabel `Tgl`, `Lokasi/Item`, `Kerusakan`, `Prioritas`, `Biaya`, `Status`), `D. Total Pengeluaran Operasional` (`Biaya Perawatan + Perbaikan`). Kosong: `Tidak ada inspeksi pada periode ini.`, `Tidak ada perawatan pada periode ini.`, `Tidak ada perbaikan pada periode ini.`, `Rp0`. Bagian Narasi dan Rekomendasi dari file Juni folder 1 **tidak** ikut (spec §9.3).

- [ ] **Step 3: Test gagal Kinerja Admin.** `LAPORAN KINERJA ADMIN`; `A. Penanganan Feedback Penghuni — Juni 2026` (`Total Feedback Masuk`, `Selesai Ditangani`, `Masih Proses`, `Total Biaya Penanganan`, `Kategori`); `B. Pelanggaran Peraturan` (`Total Pelanggaran`, `Jenis`); `C. Logbook Kecelakaan Kerja` (`Total Kecelakaan Kerja`, `Lokasi`); `LAMPIRAN — Detail Logbook (Juni 2026)` dengan `Lampiran 1. Logbook Feedback`, `Lampiran 2. Logbook Pelanggaran Peraturan`, `Lampiran 3. Logbook Kecelakaan Kerja`. Kosong: `Tidak ada feedback pada periode ini.`, `Tidak ada pelanggaran pada periode ini.`, `Tidak ada kecelakaan kerja pada periode ini.`, `Tidak ada entri pada periode ini.` (tiga kali).

- [ ] **Step 4: Jalankan → FAIL. Step 5: Implementasi.** Sumber: `maintenance_pm`, `maintenance_cm` (`tanggal_kerusakan` atau `tanggal_lapor` dalam periode; durasi dari `durasi_perbaikan_hari`), `inspeksi_fasilitas` (`tanggal`; "perlu tindak lanjut" = `tindak_lanjut_perlu` terisi/ya: **cek nilai sebenarnya**), `feedback` + `tenant_complain` (tanggal dari `reported_at`; `feedback` tidak punya kolom tanggal: **cek skema produksi** dengan `PRAGMA table_info(feedback)` dan, bila tidak ada tanggal, catat sebagai kendala dan tampilkan semua feedback terbuka; jangan mengarang tanggal).

- [ ] **Step 6: Test → PASS. Commit:** `feat(laporan-bulanan): operasional (kerja dan kinerja) serta kinerja admin`

---

### Task 9: Jadwal otomatis tanggal 1

**Files:**
- Create: `src/app/api/cron/laporan-bulanan/route.ts`, `vercel.json`
- Modify: `src/proxy.ts` (tambah `'/api/cron/(.*)'` ke `isPublicRoute`; autentikasi dilakukan di route), `.env.example` (`CRON_SECRET=`)
- Test: `src/lib/laporan-bulanan/cron.test.ts` (fungsi murni `pilihLaporanBelumAda`)

**Interfaces:**
- Consumes: `LAPORAN`, `generateLaporan`, `laporanSudahAda`, `periodeSebelumnya` (Task 1, 3)
- Produces: `pilihLaporanBelumAda(semuaId: string[], sudahAda: Set<string>): string[]` (murni); `GET /api/cron/laporan-bulanan` → `{ periode, hasil: { id: string; status: 'dibuat' | 'dilewati' | 'gagal'; error?: string }[] }`

- [ ] **Step 1: Test gagal:** `pilihLaporanBelumAda(['a','b','c'], new Set(['b']))` → `['a','c']`; set penuh → `[]`.

- [ ] **Step 2: Implementasi route.** Tolak 401 bila header `Authorization` bukan `Bearer ${process.env.CRON_SECRET}` (juga bila env kosong). Loop berurutan per laporan, `try/catch` per laporan (satu gagal tidak menghentikan sisanya), lewati yang sudah ada di `laporan_riwayat`, `export const maxDuration = 300`. `dibuat_oleh` = `'Jadwal otomatis'`. Periode = `periodeSebelumnya(new Date())`.

- [ ] **Step 3: `vercel.json`:** `{ "crons": [{ "path": "/api/cron/laporan-bulanan", "schedule": "0 1 1 * *" }] }` (01:00 UTC = 08:00 WIB). Catatan eksekusi: batas durasi fungsi tergantung paket Vercel; 11 PDF berurutan butuh sekitar 1 sampai 2 menit. Bila paket membatasi 60 detik, pecah jadi beberapa pemanggilan (parameter `?kelompok=`) dan tambah entri cron.

- [ ] **Step 4: Verifikasi lokal.** Dengan `CRON_SECRET=uji` di `.env.local`: panggil tanpa header → 401; header salah → 401; header benar → 200 dan baris riwayat bertambah; panggil kedua kali → semua `dilewati`. **Hapus baris riwayat uji** (`DELETE FROM laporan_riwayat WHERE dibuat_oleh = 'Jadwal otomatis'`) dan berkas uji di Drive setelah itu.

- [ ] **Step 5: Commit:** `feat(laporan-bulanan): jadwal otomatis tanggal 1`

---

### Task 10: Skrip uji data nyata dan paritas visual

**Files:**
- Create: `scripts/laporan-bulanan-check.ts`
- Modify: `package.json` (script `"test:laporan": "tsx --test src/lib/laporan-bulanan/**/*.test.ts"`)

**Interfaces:**
- Consumes: semua `ambil*` dan `html*`.
- Produces: `npx tsx scripts/laporan-bulanan-check.ts <id|semua> <YYYY-MM>` mencetak teks laporan (tag dibuang) dan mencatat bagian yang kosong.

- [ ] **Step 1: Implementasi skrip** mengikuti pola `scripts/laporan-check.ts` (`import './_env'`). Pakai `parsePeriode`. Tidak menulis ke database.

- [ ] **Step 2: Jalankan semua test.** Run: `npm run test:laporan` → semua PASS. Run: `npx tsc --noEmit` → tanpa error.

- [ ] **Step 3: Paritas data Juni 2026.** Run: `npx tsx scripts/laporan-bulanan-check.ts semua 2026-06`. Bandingkan dengan Drive (kolom "Hasil membaca Drive" di spec): jumlah penghuni baru Juni (Owner), Kas Masuk `Rp30.550.000`, Kas Keluar `Rp3.731.250`, Pendapatan `Rp11.825.000`, perawatan 2 + perbaikan 1 = `Rp375.000`. Selisih harus bisa dijelaskan (cacat contoh Drive di spec §3.4 sengaja tidak ditiru). Catat hasil di akhir spec.

- [ ] **Step 4: Paritas visual.** Buka PDF hasil dan dokumen Drive berdampingan (browser pane), satu per keluarga: Pekerjaan Admin, Kerja Operasional, Kinerja Keuangan, Owner Review. Periksa font, warna header tabel, margin, urutan bagian, tanda tangan. Perbaiki CSS di `shell.ts` sampai sama; ulangi untuk laporan sisanya.

- [ ] **Step 5: Bulan kosong.** `npx tsx scripts/laporan-bulanan-check.ts semua 2026-10` → 11 laporan terbentuk, tidak ada `NaN`, `undefined`, atau `[object`.

- [ ] **Step 6: Commit:** `test(laporan-bulanan): skrip paritas data dan skrip npm`

---

## Self-Review

**Cakupan spec:** §2 11 template → Tugas 2 (4), 5 (1), 6 (2), 7 (1), 8 (3). §3.1 penghuni keluar → Tugas 5. §3.2 rekomendasi dinamis → Tugas 5. §3.3 tabel pelanggaran/kecelakaan → titik sambung Tugas 8, tabel + form di plan terpisah (diumumkan di Cakupan). §3.4 cacat contoh → Tugas 10 Langkah 3. §4 arsitektur → Tugas 1 sampai 3. §8 tahap 1 sampai 3, 5 → Tugas 1 sampai 9. §9 keputusan: PDF (Tugas 3), tombol + jadwal + periode (Tugas 3, 4, 9), Operasional dua gaya (Tugas 8). §10 penyesuaian: pemilih periode sejak awal (Tugas 4), idempoten cron (Tugas 9), ID folder di `app_config` (Tugas 3), hak akses (Global Constraints).

**Konsistensi tipe:** `Periode`, `StatusTugas`, `DataPekerjaan`, `LaporanDef`, `generateLaporan`, `laporanSudahAda`, `periodeSebelumnya` dipakai dengan nama sama di Tugas 3 dan 9. Id registri tercantum lengkap di Tugas 3.

**Hal yang sengaja belum pasti dan dicek saat membangun (bukan ditebak):** nilai `status_booking` dan `hasil_survey`, kolom institusi penghuni, kolom tanggal `feedback`, format tanggal di `content`, rumus `er_persen`, batas durasi fungsi Vercel. Tiap titik punya langkah pemeriksaan di tugasnya.
