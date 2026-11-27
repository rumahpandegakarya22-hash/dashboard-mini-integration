# Pengingat Jatuh Tempo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Tiga section tagihan di beranda `/ops` dengan tombol WhatsApp, setting rekening, dan rangkuman Telegram harian tanpa dobel.

**Architecture:** Logika murni di `src/lib/pengingat/`; daftar dihitung langsung dari DB tiap beranda dibuka; satu tabel log baru hanya untuk anti-dobel Telegram; rekening di `app_config`.

**Tech Stack:** Next.js 16, React 19, @libsql/client, `tsx --test`. Tanpa dependensi baru.

**Spec:** `docs/superpowers/specs/2026-11-27-pengingat-jatuh-tempo-design.md`

## Global Constraints

- Role melihat daftar: `owner`, `admin_finance`, `sales`. Role mengubah rekening: `owner`.
- Semua "hari ini" GMT+7 (`hariIniIso` di `src/lib/format-tanggal.ts`).
- Tahap, `selisih = hari ini - jatuh tempo`: `terlambat` ≥ 7; `jatuh_tempo` 0..6; `pengingat` -3..-1.
- Tanpa nominal di draft, kartu, dan Telegram.
- Teks draft persis seperti bagian "Isi draft" di spec.
- Tidak ada pesan WhatsApp/Telegram sungguhan. Uji DB hanya file libSQL lokal.
- Tanpa commit/push tanpa izin pengguna (langkah commit ditunda).

## Review Focus

- `periode_akhir` berakhiran jam atau berisi teks bebas: dipotong ke tanggal / dilewati, tidak merobohkan daftar (Task 2).
- Nomor HP `+62 852-…`, `852…`, `-`, kosong: dinormalkan atau tombol nonaktif (Task 1).
- Nama berisi `<`, `&`: pesan Telegram tetap valid (Task 3).
- Env Telegram kosong: tidak ada baris terklaim (Task 3).
- Rekening di `app_config` rusak (bukan JSON): dianggap belum diatur (Task 1).

---

### Task 1: Logika murni

**Files:** Create `src/lib/pengingat/tagihan.ts`, `src/lib/pengingat/rekening.ts`, `src/lib/pengingat/tagihan.test.ts`. Modify `src/lib/format-tanggal.ts` (`hariIniIso(sekarang = new Date())`), `src/lib/jurnal.ts` (export `tambahBulan`), `src/lib/draft-info/render.ts` (`tautanWhatsApp(teks, seluler = true, nomor = '')`).

**Interfaces (Produces):**
- `type Tahap = 'terlambat' | 'jatuh_tempo' | 'pengingat'`; `const URUTAN_TAHAP: Tahap[]`
- `bolehLihatPengingat(role): boolean`
- `tahapDari(selisih: number): Tahap | null`
- `interface BarisTagihan { idPenghuni; nama; panggilan; noKamar; tipe; noHp; jatuhTempo: string; bulan: number }`
- `interface Tagihan extends BarisTagihan { tahap; selisih: number }`
- `susunDaftar(baris: BarisTagihan[], hariIni: string): Record<Tahap, Tagihan[]>`
- `keterangan(t: Tagihan): string` → "Lewat n hari" | "Hari ini" | "n hari lagi"
- `susunDraft(t: Tagihan, r: Rekening): string`
- `nomorWa(noHp: string): string` ('' bila tidak cocok `^62\d{8,13}$`)
- `interface Rekening { bank; nomor; atasNama }`; `validasiRekening(input: unknown): Rekening` (throw); `bacaNilaiRekening(raw: string | null): Rekening | null`; `barisRekening(r): string` → `🏦 {bank} — {nomor} a.n. {atasNama}`; `gantiRekeningTemplate(isi: string, r: Rekening | null): string`; `bolehKelolaRekening(role): boolean`

- [ ] Tulis test: batas -4→null, -3→pengingat, -1→pengingat, 0→jatuh_tempo, 6→jatuh_tempo, 7→terlambat; `hariIniIso` pada `2026-11-26T16:59Z` = `2026-11-26`, pada `17:00Z` = `2026-11-27`; periode 31 Jan 2027 + 1 → "31 Januari 2027 s.d. 28 Februari 2027"; 2028 → 29 Februari; urutan isi tiap section; draft tiga tahap (kalimat pembuka persis, tanpa "Rp"); role (6 role); `nomorWa`; rekening valid/invalid/JSON rusak; template #21 dan #22 dari `templates.json` memakai rekening baru dan tidak lagi memuat nomor lama; `tautanWhatsApp` dengan nomor.
- [ ] Jalankan `npx tsx --test "src/lib/pengingat/*.test.ts"` → FAIL.
- [ ] Implementasi. `gantiRekeningTemplate` mengganti baris yang cocok `/^🏦 .*a\.n\. .*$/gm`.
- [ ] Jalankan lagi, plus `src/lib/draft-info/render.test.ts` → PASS.

### Task 2: Query, migrasi, setting rekening

**Files:** Create `db/schema/039_pengingat_tagihan.sql`, `src/lib/pengingat/db.ts`, `src/lib/pengingat/db.test.ts`, `src/app/api/ops/admin/rekening/route.ts`, `src/app/(ops)/ops/admin/rekening/page.tsx`, `src/components/RekeningPanel.tsx`. Modify `src/components/module-icons.tsx` (entri `NAV_PENGATURAN`, `ownerOnly`), `src/app/(ops)/ops/admin/draft-info/page.tsx`.

**Interfaces:**
- Produces: `bacaTagihan(db: Client): Promise<BarisTagihan[]>`; `bacaRekening(db: Client): Promise<{ rekening: Rekening | null; olehSiapa: string | null; kapan: string | null }>`
- Migrasi: `tagihan_pengingat_log(id_penghuni TEXT, jatuh_tempo TEXT, tahap TEXT, dikirim_pada TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id_penghuni, jatuh_tempo, tahap))` dan `INSERT OR IGNORE INTO app_config` kunci `rekening_pembayaran`.
- API: `GET` dan `PUT` `{bank, nomor, atasNama}`, 403 selain owner, `writeAudit` moduleId `rekening`.

- [ ] Test pada file libSQL sementara: void diabaikan; belum dibayar diabaikan; penghuni tanpa invoice dan yang sudah check-out tidak muncul; dua invoice `periode_akhir` sama → `id` terbesar; `periode_akhir` "2026-11-30 00:00:00" → "2026-11-30"; teks bebas dilewati; tipe jatuh ke invoice bila `kamar.tipe_kamar` kosong; migrasi dijalankan dua kali tidak menimpa rekening yang diubah.
- [ ] Jalankan → FAIL; implementasi; jalankan → PASS.
- [ ] Halaman dan panel mengikuti pola `kontrak/page.tsx`; konfirmasi `window.confirm` berisi `barisRekening` sebelum simpan.
- [ ] `npx tsc --noEmit` → 0 error.

### Task 3: Telegram

**Files:** Create `src/lib/pengingat/telegram.ts`, `src/lib/pengingat/telegram.test.ts`, `src/app/api/cron/pengingat-tagihan/route.ts`. Modify `vercel.json`.

**Interfaces:**
- Consumes: `susunDaftar`, `bacaTagihan`, `keterangan`.
- Produces: `susunPesanTelegram(daftar: Tagihan[], tautan: string): { teks: string; isi: Tagihan[] }[]` (tiap teks ≤ 4096); `jalankanPengingat(db, kirim: (teks: string) => Promise<void>, hariIni: string, tautan: string): Promise<{ terkirim: number }>`; `kirimTelegram(token, chatId, teks): Promise<void>` (throw bila gagal, token tidak masuk pesan error).

- [ ] Test dengan pengirim tiruan: run kedua tidak mengirim; tahap berubah → kirim lagi; kirim gagal → throw, klaim dihapus, run berikut mengirim; dua run bersamaan → satu pengiriman; tidak ada entri → tidak ada pesan; nama `A <b>&` di-escape; 80 entri dipecah ≤ 4096 tanpa entri hilang.
- [ ] Jalankan → FAIL; implementasi (klaim: `INSERT ... ON CONFLICT DO NOTHING RETURNING`); jalankan → PASS.
- [ ] Route: `cronDiizinkan` → 401; env Telegram kosong → 500 sebelum menyentuh DB; gagal → 500. `vercel.json` tambah `{"path": "/api/cron/pengingat-tagihan", "schedule": "0 1 * * *"}`.

### Task 4: Beranda

**Files:** Create `src/components/PengingatTagihan.tsx`. Modify `src/app/(ops)/ops/page.tsx`, `src/styles/theme-ops.css`.

**Interfaces:** props `{ daftar: Record<Tahap, KartuTagihan[]> | null }`, `KartuTagihan = { id, nama, noKamar, tipe, jatuhTempo, keterangan, nomor, draft: string | null }`. `null` = gagal baca. `draft` null = rekening belum diatur.

- [ ] Query hanya bila `bolehLihatPengingat(user.role)`; letak di antara `PendingAnnouncement` dan `Joblist`.
- [ ] Section: judul + jumlah + ikon + warna dari token tema; kosong "Tidak ada"; tombol minimal 44px.
- [ ] `npx tsc --noEmit` dan `npm run build` → sukses.

### Task 5: Verifikasi

- [ ] Semua test baru dan lama lulus.
- [ ] Dev server memakai DB file lokal berisi data uji; cek beranda 375px, mode terang dan gelap, href tombol, halaman rekening, Draft Info #22.
- [ ] Panggil endpoint cron tanpa secret (401) dan tanpa env Telegram (500, log kosong).
- [ ] Audit vibe-security pada diff.
