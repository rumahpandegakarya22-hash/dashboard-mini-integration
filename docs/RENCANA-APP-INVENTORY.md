# Rencana Penggabungan App Inventory Stock ke Repo Utama

*Catatan persiapan — dibuat 2026-07-22. Belum ada kode yang diubah.*

---

## 1. Ringkasan Eksekutif

Rencana awal dibaca sebagai "menambah UI ketiga seperti Mini App Ops". Setelah
pengecekan kode, **ini bukan bikin app baru dari nol — ini memindahkan app yang
sudah jalan di produksi (`inventorystockktd.vercel.app`) masuk ke repo ini.**

Bedanya besar. Bikin app baru = tambah folder. Memindahkan app existing = ada
2 integrasi hidup yang harus dipotong tanpa mematikan fitur yang sudah dipakai.

Bukti di kode (bukan asumsi):

| Yang sudah ada | Lokasi | Perannya sekarang |
|---|---|---|
| Klien REST ke app Inventory | [src/lib/inventory.ts](src/lib/inventory.ts:1) | Mini App **menulis** pemakaian stok via HTTP + Bearer token |
| Klien libSQL ke DB Inventory | [src/lib/dashboard/inventory.ts](src/lib/dashboard/inventory.ts:1) | Dashboard **membaca** DB Inventory langsung untuk halaman monitoring stok |
| Modul stok di Ops | [registry.ts](src/lib/modules/registry.ts:1) — `pemakaian-stok-cleaning`, `pemakaian-stok-maintenance` | Form pemakaian stok untuk staff |
| Halaman stok Dashboard | [views/pages.ts:117](src/lib/dashboard/views/pages.ts:117) `inventoryRows()` | Tabel monitoring |

Artinya app Inventory sekarang **sudah jadi sumber data untuk dua app lain**.
Menariknya masuk = menghapus batas HTTP itu, dan itu yang harus dikerjakan hati-hati.

**Kabar baiknya:** karena penggunanya orang yang sama dengan Ops (sudah kamu
konfirmasi), sisi auth adalah bagian termurah. Tidak ada tabel user baru, tidak
ada perubahan webhook Clerk.

---

## 2. Keputusan yang Sudah Dikunci

| Hal | Keputusan | Konsekuensi |
|---|---|---|
| Pengguna | Sama dengan pemakai Ops | Pakai `AuthState.user` + `Role` yang ada. **Tidak** bikin sumbu akses baru seperti `dashboardUser` |
| Guard | `guardInventory()` = salinan `guardOps()` | Cukup tambah 1 fungsi di [routing.ts](src/lib/core/routing.ts:38) |
| Data | DB Turso Inventory yang sudah ada | Tidak migrasi data, tidak bikin schema baru |

---

## 3. Yang Harus Diperhatikan — Diurut dari Paling Berisiko

### 3.1 [PRIORITAS 1] Dua integrasi hidup harus dipotong, bukan dibiarkan

Ini titik paling rawan. Setelah Inventory ada di repo yang sama, memanggil
dirinya sendiri lewat HTTP itu konyol dan rapuh — tapi kalau kamu lupa
memotongnya, fitur tetap jalan (karena app lama masih online) dan kamu tidak
akan sadar ada duplikasi sampai app lama dimatikan.

**Aturan main: jangan matikan `inventorystockktd.vercel.app` sampai kedua
integrasi di bawah sudah diganti dan diuji.**

- **Integrasi A — Mini App menulis pemakaian stok** ([lib/inventory.ts](src/lib/inventory.ts:1))
  `fetchMaterials()` dan `postUsage()` memanggil `INVENTORY_API_URL` via `fetch`.
  Setelah digabung, keduanya harus jadi query langsung ke DB. Perhatikan:
  `postUsage()` mengembalikan `newStock`, `totalCost`, `transactionId` — logika
  pengurangan stok + hitung biaya ada **di app Inventory, bukan di repo ini**.
  Logika itu harus ikut pindah, dan itu bukan copy-paste sepele: pengurangan
  stok idealnya satu transaksi atomik, bukan read-then-write.

- **Integrasi B — Dashboard membaca DB Inventory** ([lib/dashboard/inventory.ts](src/lib/dashboard/inventory.ts:1))
  Ini pakai `createClient()` terpisah dengan `INVENTORY_DATABASE_URL` + cache
  60 detik. Karena sifatnya read-only dan sudah baca DB langsung, **integrasi
  ini paling aman dibiarkan apa adanya untuk MVP.** Jangan gabungkan client-nya
  ke koneksi Turso utama di tahap awal — DB-nya memang beda instance.

> **Pertanyaan yang harus kamu jawab sebelum mulai:** DB Inventory tetap jadi
> database terpisah, atau mau dilebur ke DB utama? Kalau tetap terpisah (saran
> saya untuk MVP), semua di atas jadi jauh lebih ringan.

### 3.2 [PRIORITAS 2] `AppShell` masih hardcoded ke `/ops`

[AppShell.tsx](src/components/AppShell.tsx:1) bukan komponen generik meski
namanya terdengar generik. Path `/ops` ditulis literal di beberapa tempat:

```
const isHome = pathname === '/ops';
const isAdmin = pathname.startsWith('/ops/admin');
const isAccount = pathname.startsWith('/ops/account');
const activeModule = modules.find((m) => pathname === `/ops/m/${m.id}`);
```

Judul default `'Kost Tiga Dara'` dan navigasi modul per divisi juga khas Ops.

Dua pilihan, dan pilih sadar — jangan asal:

| Opsi | Isi | Cocok kalau |
|---|---|---|
| **A. Shell sendiri** (saran MVP) | Bikin `InventoryShell.tsx` terpisah | Navigasi Inventory beda (kategori barang, bukan divisi staff). Lebih cepat, tidak menyentuh Ops sama sekali → **nol risiko regresi di Ops** |
| **B. Generalisasi AppShell** | Tambah prop `basePath` | Navigasinya benar-benar mirip Ops. Tapi menyentuh file yang dipakai Ops produksi |

Saya sarankan **A**. Ops sudah stabil di produksi; tidak ada alasan mengambil
risiko menyentuhnya demi menghemat satu file.

### 3.3 [PRIORITAS 2] CSS scoping — pola ini sudah pernah bocor

Commit `029542e` memperbaiki 96 selector `theme-ops.css` yang bocor ke
Dashboard. Jangan ulangi kesalahan yang sama.

- Wrapper wajib: `<div data-app="inventory">` di layout.
- File `src/styles/theme-inventory.css`, **setiap selector** di-prefix
  `[data-app='inventory']`.
- `globals.css` hanya untuk token yang benar-benar dipakai bersama tiga app.
  Komentar di [globals.css](src/styles/globals.css:1) masih bilang "dashboard &
  ops" — perbarui.

Cara cepat memverifikasi tidak bocor: buka halaman Ops dan Dashboard setelah
menambah tema baru, pastikan tidak ada yang berubah sedikit pun.

### 3.4 [PRIORITAS 3] Titik sentuh routing & akses

- **[routing.ts](src/lib/core/routing.ts:1)** — tambah `'/inventory'` ke type
  `Landing`, tambah `guardInventory()`. Untuk `resolveLanding()`: **jangan
  taruh Inventory di atas dashboard/ops.** Urutan sekarang dashboard → ops
  → pending, dan itu sengaja. Inventory paling aman tidak masuk `resolveLanding`
  sama sekali di MVP — diakses lewat tautan silang saja.

- **[roles.ts](src/lib/core/roles.ts:1)** — siapa yang boleh? `canAccess()`
  memberi `owner` dan `pengawas` akses ke segalanya secara otomatis. Untuk
  staff, tentukan: apakah `staff_cleaning` / `staff_maintenance` (yang sudah
  pakai modul pemakaian stok) boleh masuk app Inventory penuh, atau cuma
  Owner/Pengawas yang boleh atur stok? **Ini keputusan bisnis, bukan teknis —
  putuskan sebelum menulis guard.**

- **[proxy.ts](src/proxy.ts:1)** — tidak perlu diubah. `isPublicRoute` hanya
  memuat rute publik; `/inventory` otomatis terlindungi. Cukup dipastikan, bukan
  diedit.

- **Tautan silang** — `AppShell` punya prop `hasDashboardAccess`. Perlu
  padanannya supaya user bisa lompat Ops ↔ Inventory.

### 3.5 [PRIORITAS 3] Env & operasional

Env `INVENTORY_*` yang ada sekarang mengasumsikan app terpisah. Setelah
digabung, `INVENTORY_API_URL` + `INVENTORY_API_TOKEN` menjadi mati — **hapus
baru setelah Integrasi A selesai diganti**, bukan sebelumnya.
`INVENTORY_DATABASE_URL` + `INVENTORY_AUTH_TOKEN` tetap dipakai.

Cek juga: apakah CSP di [lib/core/csp.ts](src/lib/core/csp.ts) mengizinkan
domain `inventorystockktd.vercel.app`? Kalau ya, entri itu bisa dihapus di akhir.

---

## 4. Alur Kerja yang Disarankan

```
[Hari 1] Kerangka kosong — tanpa menyentuh apa pun yang sudah jalan
   │  (ops)/ disalin → (inventory)/, guard, tema, shell sendiri
   │  Halaman cuma "Hello" — buktikan auth + tema tidak bocor
   ▼
[Hari 2] Baca-saja — risiko rendah, hasil langsung terlihat
   │  Daftar barang & stok, baca DB Inventory (client yg sudah ada)
   ▼
[Hari 3] Tulis — di sinilah logika app lama harus benar-benar pindah
   │  Form masuk/keluar stok, transaksi atomik
   ▼
[Hari 4] Potong integrasi HTTP (Integrasi A) + uji modul Ops pemakaian-stok
   ▼
[Terakhir, setelah semua terbukti] Matikan app lama & bersihkan env
```

Prinsipnya: **app lama tetap hidup sampai penggantinya terbukti.** Ini pola yang
sudah kamu pakai waktu cutover Google Sheets → Turso, dan berhasil.

---

## 5. Checklist Eksekusi

**Tahap 1 — Kerangka (aman, tidak menyentuh produksi)**
- [ ] `src/app/(inventory)/layout.tsx` — salin dari [(ops)/layout.tsx](src/app/(ops)/layout.tsx), ganti `data-app="inventory"`
- [ ] `src/app/(inventory)/inventory/page.tsx` — halaman kosong dulu
- [ ] `guardInventory()` + `Landing` di [routing.ts](src/lib/core/routing.ts)
- [ ] `src/styles/theme-inventory.css` + import di `globals.css`
- [ ] `InventoryShell.tsx`
- [ ] **Verifikasi: buka Ops & Dashboard — tidak ada satu pun yang berubah**

**Tahap 2 — Baca**
- [ ] Tentukan hak akses role (lihat 3.4)
- [ ] `src/app/api/inventory/` untuk endpoint baru
- [ ] Halaman daftar barang + stok

**Tahap 3 — Tulis**
- [ ] Pindahkan logika pengurangan stok & hitung biaya dari app lama
- [ ] Pastikan atomik (satu transaksi, bukan read-then-write)

**Tahap 4 — Potong integrasi**
- [ ] Ganti isi `fetchMaterials()` / `postUsage()` di [lib/inventory.ts](src/lib/inventory.ts) jadi query DB langsung
- [ ] **Uji modul Ops `pemakaian-stok-cleaning` & `pemakaian-stok-maintenance` end-to-end**
- [ ] Uji halaman stok Dashboard masih normal

**Tahap 5 — Bersih-bersih (hanya setelah Tahap 4 terbukti)**
- [ ] Hapus env `INVENTORY_API_URL`, `INVENTORY_API_TOKEN` — di Vercel **dan** di `.env.example:86-87` (`INVENTORY_DATABASE_URL` / `INVENTORY_AUTH_TOKEN` di baris 43-44 tetap dipakai)
- [ ] Bersihkan entri CSP bila ada
- [ ] Matikan deployment `inventorystockktd.vercel.app`

---

## 6. Hal yang Belum Terjawab — Putuskan Sebelum Mulai

1. **DB Inventory tetap instance terpisah, atau dilebur ke DB utama?**
   Saran: tetap terpisah untuk MVP. Melebur = migrasi data, dan itu proyek sendiri.
2. **Role staff mana yang boleh akses app Inventory?** (lihat 3.4)
3. **Fitur apa saja yang ada di app Inventory lama?** Saya belum pernah melihat
   kodenya — catatan ini disusun dari sisi *repo ini* saja. Sebelum Tahap 3,
   perlu buka repo app Inventory untuk tahu persis logika stok & biayanya.
   *[Ini asumsi terbesar dalam dokumen ini — ditandai eksplisit.]*

---

## 7. Tingkat Keyakinan

| Klaim | Confidence | Dasar |
|---|---|---|
| App Inventory adalah app terpisah yang sudah produksi | **High** | Terbaca langsung di dua file klien |
| Pola route group + `data-app` bisa diulang untuk app ketiga | **High** | Sudah terbukti dua kali di repo ini |
| Auth tidak butuh perubahan struktural | **High** | `guardOps` bisa disalin apa adanya |
| `AppShell` perlu diduplikat, bukan digeneralisasi | **Medium** | Tergantung seberapa mirip navigasi Inventory dengan Ops |
| Estimasi 4 tahap ≈ 4 sesi kerja | **Low** | Belum melihat isi app Inventory lama |
