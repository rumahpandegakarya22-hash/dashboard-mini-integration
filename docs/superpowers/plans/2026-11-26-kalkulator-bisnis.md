# Kalkulator Bisnis Owner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menu "Kalkulator Bisnis" khusus Owner di Dashboard: simulator interaktif (slider/checkbox/angka) dengan formula yang sudah dikoreksi, grafik, dan skenario tersimpan.

**Architecture:** Mesin hitung murni (`src/lib/kalkulator/hitung.ts`) dipakai klien untuk hasil langsung. Skenario disimpan sebagai JSON tervalidasi zod di tabel `kalkulator_skenario`, yang dibuat otomatis saat pertama dipakai (pola `kamar-maintenance-skema.ts`). Akses dijaga di tiga lapis: nav, halaman, dan API.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Turso/libSQL, Clerk, zod 3, framer-motion, test `node:test` lewat `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-26-kalkulator-bisnis-design.md`

## Global Constraints
- Hanya role `owner`. Pengawas tidak boleh melihat menu, membuka halaman (404), atau memanggil API (403).
- Tidak ada dependensi baru.
- OPEX tidak termasuk penyusutan (konsisten dengan dashboard).
- Semua angka dasar per bulan. Angka tahunan = × 12 dan diberi label "/thn".
- Pembagi nol / tidak terdefinisi → `null` (tampil "—"). Tidak boleh ada NaN atau Infinity di output.
- Batas zod: harga/nominal ≤ 1e10, watt ≤ 1e5, jam 0–24, faktor 1–100, hari 1–31, jumlah kamar ≤ 1000, string ≤ 80, array ≤ 50, nama skenario 1–80, body ≤ 64 KB, maksimal 100 skenario aktif.
- Teks UI berbahasa Indonesia. Palet Owner (`G.ownPrimary/ownRose/ownGray`, `PAL.owner`).

## Review Focus
1. Kamar terisi > jumlah kamar setelah jumlah kamar diturunkan lewat slider → terisi ikut dijepit (clamp), hasil tetap valid. Test di Task 1 (`normalisasi`).
2. Semua tipe kamar dihapus / total kamar 0 → BEP, OER, WACM `null`, UI tidak crash. Test di Task 1.
3. Input angka kosong atau teks saat diketik → diperlakukan 0, tidak menyimpan NaN. Test di Task 1 (`normalisasi`).
4. JSON skenario lama atau rusak di DB → dibuang dari daftar dengan aman (`safeParse`), tidak menjatuhkan halaman. Test di Task 2.
5. Simpan oleh Pengawas/role lain lewat API langsung → 403. Dicek di Task 2 (`hanyaOwner`) dan Task 5 (E2E).

---

### Task 1: Mesin hitung + skenario default

**Files:**
- Create: `src/lib/kalkulator/tipe.ts`, `src/lib/kalkulator/hitung.ts`, `src/lib/kalkulator/default.ts`
- Test: `src/lib/kalkulator/hitung.test.ts`
- Modify: `package.json` (script `"test:kalkulator": "tsx --test \"src/lib/kalkulator/**/*.test.ts\""`)

**Interfaces (Produces):**
```ts
// tipe.ts
export interface AlatListrik { nama: string; watt: number; jumlah: number; jamPerHari: number; faktorPemakaian: number; aktif: boolean }
export interface ItemBiaya { nama: string; nominal: number; sifat: 'tetap' | 'variabel'; penyusutan: boolean; aktif: boolean }
export interface TipeKamar { nama: string; jumlahKamar: number; kamarTerisi: number; hargaSewa: number; alatListrik: AlatListrik[]; itemBiaya: ItemBiaya[] }
export interface ItemFasum { nama: string; jumlah: number; harga: number; penyusutan: boolean; aktif: boolean }
export interface SkenarioInput {
  umum: { hariPerBulan: number; tarifListrik: number; pajakAktif: boolean; pajakPersen: number };
  tipeKamar: TipeKamar[];
  fasum: ItemFasum[];
  listrikFasum: { aktif: boolean; alat: AlatListrik[] };
  pbb: { aktif: boolean; pbbTahunan: number; luasRumah: number; luasKos: number };
  investasi: { modalAwal: number };
  upgrade: { aktif: boolean; biayaInvestasi: number; kenaikanSewaPerKamar: number; kamarTerdampak: number; tambahanBiayaPerBulan: number };
  akuisisi: { biaya: { nama: string; nominal: number }[]; penghuniBaru: number };
  barangTambahan: { alat: AlatListrik[]; pembulatanKe: number };
}
export interface HasilTipe { nama: string; jumlahKamar: number; kamarTerisi: number; pendapatan: number; listrikPerKamar: number; variabelPerKamar: number; tetapPerKamar: number; cm: number; cmRatio: number | null; labaPerKamar: number | null }
export interface HasilHitung {
  totalKamar: number; kamarTerisi: number; okupansi: number | null;
  pendapatan: number; biayaVariabel: number; biayaTetap: number; penyusutan: number; opex: number; oer: number | null;
  listrikFasum: number; listrikFasumKwhHari: number; pbbBulanan: number;
  labaSebelumPajak: number; pajak: number; labaBersih: number;
  perTipe: HasilTipe[];
  wacm: number | null; bep: number | null; bepOkupansi: number | null; bepPendapatan: number | null; marginOfSafety: number | null;
  roiTahunan: number | null; paybackUsaha: number | null;
  upgrade: { deltaLaba: number; payback: number | null; roiTahunan: number | null };
  cac: number | null; cacPayback: number | null;
  sensitivitas: { okupansi: number; laba: number }[];
  barangTambahan: { kwhBulan: number; biaya: number; tarifDibulatkan: number };
  peringatan: string[];
}
// hitung.ts
export function biayaListrik(alat: AlatListrik[], hari: number, tarif: number): { kwhBulan: number; biaya: number }
export function normalisasi(input: SkenarioInput): SkenarioInput   // clamp + NaN→0
export function hitung(input: SkenarioInput): HasilHitung            // memanggil normalisasi dulu
// default.ts
export const SKENARIO_DEFAULT: SkenarioInput
export const alatBaru: () => AlatListrik; export const itemBiayaBaru: () => ItemBiaya; export const fasumBaru: () => ItemFasum; export const tipeKamarBaru: () => TipeKamar
```

Aturan hitung (dari spec §4, plus keputusan berikut):
- kWh/bulan alat = watt × jumlah × jam × hari × faktor/100 / 1000. Alat `aktif:false` = 0.
- Pajak (bila aktif) = pajakPersen/100 × pendapatan. Karena ikut pendapatan, pajak masuk CM: CM_i = harga_i × (1 − p) − variabel_i.
- Upgrade aktif: pendapatan += kamarTerdampak × kenaikan × (1 − p); biaya tetap += tambahanBiaya. Untuk BEP/WACM, kenaikan rata-rata `kamarTerdampak × kenaikan / totalKamar` ditambahkan ke setiap harga. `deltaLaba = kamarTerdampak × kenaikan × (1 − p) − tambahanBiaya` (dihitung walau upgrade nonaktif, untuk panel upgrade).
- labaPerKamar_i = CM_i − fasum/totalKamar − tetapPerKamar_i (null bila totalKamar 0).
- sensitivitas: okupansi 0,5,…,100. Terisi_i = jumlahKamar_i × okupansi/100, biaya tetap konstan.
- paybackUsaha / upgrade.payback = ceil(modal / laba) bila modal > 0 dan laba > 0, selain itu null. BEP = ceil(biayaTetap / wacm) bila wacm > 0.
- cacPayback = cac / wacm. tarifDibulatkan = ceil(biaya / pembulatanKe) × pembulatanKe (pembulatanKe ≤ 0 → biaya).
- peringatan: `"Listrik kamar <nama> belum diisi"` untuk tipe dengan kamarTerisi > 0 dan tanpa alat aktif. `"Biaya tetap belum tertutup: laba negatif"` bila labaBersih < 0.

Nilai `SKENARIO_DEFAULT` (dari sheet, dikoreksi):
- umum `{30, 1444, false, 0}` · investasi `{modalAwal: 0}` · upgrade `{false, 17_000_000, 30_000, 30, 830_000}` · akuisisi `{[{Mamikos, 50_000}], 8}` · pbb `{true, 4_448_130, 497, 528}`.
- Eco 25/25 @850.000. Alat: Charger HP 20W×1×12h, Charger Laptop 65W×1×12h, Kipas Angin 65W×1×15h. Biaya: Penyusutan Furniture 125.000 (tetap, penyusutan).
- Classic 3/3 @1.200.000. Alat: []. Biaya: Servis AC 40.000 tetap · Kebersihan KM Dalam 50.000 variabel · Penyusutan Furniture 125.000 tetap+peny · Penyusutan Elektronik 50.000 tetap+peny.
- Comfy 2/2 @1.600.000. Alat: []. Biaya: Servis AC 40.000 · Kebersihan KM Dalam 50.000 variabel · Penyusutan Furniture 150.000 · Penyusutan Elektronik 100.000.
- Fasum: Internet 1×500.000 · Petugas Kebersihan 2×1.800.000 · Iuran Lingkungan 1×75.000 · Perawatan Fasum 1×200.000 · Penyusutan Fasum 1×330.000 (peny) · Kebersihan KM Bersama 8×50.000.
- Listrik fasum (aktif): Lampu 7W×21×12h · Pompa Air 500×1×2 · Pompa Pendorong 350×1×2 · Kulkas Bawah 100×1×12 · Kulkas Atas 100×1×12 · Wifi 7×7×24 · Dispenser 240×2×2. Semua faktor 100.
- Barang tambahan: Rice Cooker 350×1×0,5 · Charger Laptop >65W 250×1×2 · Hair Dryer 400×1×0,25. pembulatanKe 5.000.

- [ ] **Step 1: Tulis test gagal** `hitung.test.ts`:
  - `golden default`: pendapatan 28_050_000. listrikFasum 346_560, listrikFasumKwhHari 8. perTipe[0].listrikPerKamar ≈ 86_423.4. pbbBulanan ≈ 190_944.117. biayaVariabel 2_410_585. biayaTetap ≈ 9_992_504.117. penyusutan 4_480_000. opex ≈ 7_923_089.117. oer ≈ 0.28246. labaBersih ≈ 15_646_910.883. wacm ≈ 854_647.167. bep 12, bepOkupansi 0.4, marginOfSafety 0.6. cac 6_250. roiTahunan null, paybackUsaha null (toleransi 1e-3).
  - `upgrade`: dengan `upgrade.aktif = true` → deltaLaba 70_000, upgrade.payback 243, upgrade.roiTahunan ≈ 0.049412, labaBersih ≈ 15_716_910.883.
  - `pajak`: pajakAktif true, 10% → pajak 2_805_000, labaBersih ≈ 12_841_910.883.
  - `faktor & aktif`: alat aktif:false → biaya 0. faktor 50 → setengah.
  - `tepi`: tipeKamar [] → totalKamar 0, oer null, wacm null, bep null, tanpa NaN (cek rekursif semua angka `Number.isFinite`). penghuniBaru 0 → cac null. Laba ≤ 0 dengan modal > 0 → paybackUsaha null.
  - `normalisasi`: kamarTerisi 40 dengan jumlahKamar 25 → 25. Watt NaN → 0. Jam 30 → 24. Faktor 0 → 1. hariPerBulan 0 → 1.
  - `sensitivitas`: 21 titik. Titik okupansi 100 laba = labaBersih default. Monoton naik bila semua CM > 0.
  - `peringatan`: default berisi "Listrik kamar Classic belum diisi" dan "…Comfy…".
  - `barang tambahan`: biaya = (350×0,5 + 250×2 + 400×0,25) × 30 × 1444 / 1000 = 33_573. tarifDibulatkan 35_000.
- [ ] **Step 2:** `npx tsx --test src/lib/kalkulator/hitung.test.ts` → FAIL (modul belum ada).
- [ ] **Step 3:** Implementasi `tipe.ts`, `default.ts`, `hitung.ts` sesuai interface dan aturan di atas.
- [ ] **Step 4:** `npm run test:kalkulator` → semua PASS.
- [ ] **Step 5:** Commit `feat(kalkulator): mesin hitung analisis bisnis dengan formula terkoreksi`.

### Task 2: Skema zod, tabel DB, API owner-only

**Files:**
- Create: `src/lib/kalkulator/skema.ts`, `src/lib/kalkulator/skema-db.ts`, `db/schema/037_kalkulator_skenario.sql`, `src/app/api/dashboard/kalkulator/route.ts`
- Test: `src/lib/kalkulator/skema.test.ts`

**Interfaces:**
- Consumes: `SkenarioInput`, `SKENARIO_DEFAULT` (Task 1), `requireDashboardAuth`, `requireOwner`, `writeAudit`, `turso()`, `nowWib()`.
- Produces:
```ts
export const skemaInput: z.ZodType<SkenarioInput>
export const skemaSimpan: z.ZodObject<{ id?: number; nama: string; data: SkenarioInput }>
export const skemaHapus: z.ZodObject<{ id: number; hapus: true }>
export function parseData(json: string): SkenarioInput | null   // JSON.parse + safeParse, null bila rusak
export const DDL_KALKULATOR: string[]
export function pastikanSkemaKalkulator(db: Client): Promise<void>
export const hanyaOwner: (role: string) => boolean
// API: GET → { skenario: { id, nama, data, diubah_pada }[] }   (urut diubah_pada desc, dihapus_pada IS NULL, data rusak dibuang)
//      POST {nama, data} → { id }        (409 bila sudah 100 aktif)
//      PUT {id, nama, data} → { ok }     PUT {id, hapus:true} → { ok } (soft delete)
```
- DDL persis seperti spec §6, ditambah `CREATE INDEX IF NOT EXISTS idx_kalkulator_aktif ON kalkulator_skenario (dihapus_pada, diubah_pada)`. File `.sql` berisi pernyataan yang sama.
- Handler: `requireDashboardAuth('kalkulator')` → `requireOwner` → tolak `content-length` > 65_536 (413) → `req.json()` gagal = 400 → zod gagal = 400 `{ error: 'Data tidak valid.' }` → `pastikanSkemaKalkulator(turso())` → query parameterized → `writeAudit` (CREATE/UPDATE, moduleId `kalkulator`, target `Turso → kalkulator_skenario`, requestId `crypto.randomUUID()`). Error tak terduga → 500 `{ error: 'Terjadi kesalahan pada server.' }` dan `console.error('[api/dashboard/kalkulator]', e)`. PUT untuk id yang tidak ada / sudah dihapus → 404.

- [ ] **Step 1: Tulis test gagal** `skema.test.ts`: SKENARIO_DEFAULT lolos `skemaInput`. Menolak: watt −1, jam 25, faktor 0, hari 32, harga 1e11, nama skenario "" dan 81 karakter, array 51 baris, field asing `__proto__`/ekstra (pakai `.strict()`), `kamarTerisi` > `jumlahKamar` (refine). `parseData('{rusak')` → null, `parseData(JSON.stringify(default))` → objek setara. `hanyaOwner('pengawas')` false, `hanyaOwner('owner')` true. Isi file `037_kalkulator_skenario.sql` (tanpa komentar/spasi berlebih) memuat setiap `DDL_KALKULATOR`.
- [ ] **Step 2:** `npm run test:kalkulator` → FAIL.
- [ ] **Step 3:** Implementasi skema, skema-db, file SQL, route.
- [ ] **Step 4:** `npm run test:kalkulator` PASS dan `npm run typecheck` bersih.
- [ ] **Step 5:** Commit `feat(kalkulator): penyimpanan skenario dan API khusus owner`.

### Task 3: Navigasi dan halaman khusus owner

**Files:**
- Modify: `src/config/dashboard-nav.ts` (`owner.pages = [...pagesFor('Owner'), { id: 'kalkulator', label: 'Kalkulator Bisnis', group: 'dash', crumb: 'Kalkulator Bisnis' }]`)
- Modify: `src/app/(dashboard)/dashboard/[view]/page.tsx`: setelah `canOpenView`, bila `view === 'kalkulator'`, cek `user.role === 'owner'` (else `notFound()`), lalu render `DashboardShell` berisi `<KalkulatorBisnis />` **tanpa** `loadDashboardData`.
- Test: tambah ke `src/lib/kalkulator/skema.test.ts`: `canOpenView('owner','kalkulator')` true, `canOpenView('pengawas','kalkulator')` false, dan role lain false.

- [ ] **Step 1:** Tulis test nav → FAIL.
- [ ] **Step 2:** Ubah nav dan halaman (`KalkulatorBisnis` sementara berupa stub yang diekspor dari Task 4 file path `src/components/kalkulator/KalkulatorBisnis.tsx`).
- [ ] **Step 3:** Test PASS, typecheck bersih. Pastikan `scripts/access-matrix-check.ts` (bila memeriksa ROLE_NAV) masih lolos: `npx tsx scripts/access-matrix-check.ts`.
- [ ] **Step 4:** Commit `feat(kalkulator): menu Kalkulator Bisnis khusus owner`.

### Task 4: UI kalkulator interaktif + grafik

**Files (Create, semua `'use client'`):**
- `src/components/kalkulator/KalkulatorBisnis.tsx`: state `SkenarioInput` (`useState`, update immutable lewat `structuredClone`), `useMemo(() => hitung(input))`. Bilah skenario: select skenario tersimpan, nama, tombol Simpan / Simpan sebagai baru / Duplikat / Hapus (konfirmasi `Modal`) / Reset ke default. Penanda "Belum disimpan" dan `beforeunload`. Pesan sukses/gagal dari API ditampilkan dalam `role="status"`.
- `src/components/kalkulator/InputAngka.tsx`: `{label, value, onChange, min, max, step, rupiah?, satuan?, slider?: boolean}`. Slider dan `<input inputMode="decimal">` sinkron. Saat tidak fokus, tampil format `id-ID`. Nilai kosong → 0.
- `src/components/kalkulator/PanelInput.tsx`: Accordion Umum · Tipe Kamar (per tipe: jumlah, terisi slider 0..jumlah, harga slider, `TabelAlat`, `TabelBiaya`) · Biaya Bersama (+PBB) · Listrik Fasum · Investasi & Upgrade (checkbox aktif) · Akuisisi · Barang Tambahan Penghuni.
- `src/components/kalkulator/TabelBaris.tsx`: tabel baris yang bisa ditambah/dihapus untuk `AlatListrik`, `ItemBiaya`, `ItemFasum`, biaya akuisisi (kolom berbeda per jenis lewat props `kolom`). Checkbox `aktif`/`penyusutan`, select sifat. Maksimal 50 baris.
- `src/components/kalkulator/HasilKalkulator.tsx`: `StatGrid` 9 kartu (Pendapatan, Laba Bersih, OPEX, OER, BEP, Margin of Safety, ROI/thn, Payback, CAC), `DonutBlock` komposisi biaya (Variabel/Tetap tunai/Penyusutan, `PAL.owner`) dan pendapatan per tipe, `Bars` CM per tipe dengan `BarStopsOwner`, ringkasan Upgrade (Δlaba, payback, ROI), tabel per tipe, dan daftar `peringatan`.
- `src/components/kalkulator/GrafikSensitivitas.tsx`: SVG responsif sendiri (viewBox, garis laba vs okupansi, garis nol, penanda vertikal BEP + label, titik okupansi saat ini). Warna dari CSS var Owner. `role="img"` + `aria-label` ringkasan.
- Modify: `src/styles/theme-dashboard.css`: tambah blok `.kalk-*` (layout 2 kolom ≥ 1024px dengan hasil `position: sticky`, 1 kolom di bawahnya, ringkasan menempel di atas pada < 1024px, target sentuh ≥ 44px, `overflow-x:auto` untuk tabel, range input memakai warna `#CF7B72`). Gunakan token warna/var yang sudah ada di file itu (cek dulu nama var-nya) supaya mode gelap ikut.

Format: Rupiah `Rp` + `toLocaleString('id-ID')` (bulat), persen 1 desimal, `null` → "—", payback "N bln (≈ X thn)", BEP tidak tercapai → "Tidak tercapai".

- [ ] **Step 1:** Bangun komponen. Isi default dari `SKENARIO_DEFAULT`, muat daftar skenario via `GET /api/dashboard/kalkulator`.
- [ ] **Step 2:** `npm run typecheck` dan `npm run build` bersih.
- [ ] **Step 3:** Commit `feat(kalkulator): UI simulator interaktif dengan grafik`.

### Task 5: Verifikasi menyeluruh
- [ ] `npm run test:kalkulator`, `npm run typecheck`, `npm run build` → semua lolos.
- [ ] Dev server. Owner: menu muncul. Menggeser slider kamar terisi Eco → Laba, BEP, dan grafik berubah. Upgrade dicentang → Δ tampil. Simpan / muat / hapus berfungsi (**hanya bila DB dev bukan produksi**; kalau produksi, minta izin dulu). Lebar 1440 dan 375: tanpa scroll horizontal, ringkasan menempel di HP.
- [ ] Pengawas: menu tidak ada, `/dashboard/kalkulator` 404, `fetch('/api/dashboard/kalkulator')` 403.
- [ ] Audit keamanan cepat (skill vibe-security) atas route baru.
