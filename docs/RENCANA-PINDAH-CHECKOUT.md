# Rencana: Verifikasi Pindah Kamar & Checkout di Mini App Ops

Ditulis 5 Agustus 2026, sebelum dibangun. Alur di bawah adalah keputusan
developer — jangan diubah sepihak saat implementasi.

## Alur yang disepakati

```
Penghuni ajukan (Teman Rara)   → status Pending
Pengelola setujui / tolak      → Disetujui = "On Process"  (DATA BELUM BERUBAH)
Pengelola tandai selesai       → data berubah FINAL, per tanggal efektif
```

Titik pentingnya: **persetujuan bukan eksekusi.** Antara disetujui dan selesai,
penghuni masih tercatat di kamar lama / masih aktif. Perubahan data baru terjadi
saat pengelola menandai selesai, karena tanggal pindah/keluar sungguhan sering
bergeser dari tanggal pengajuan.

## Yang berubah saat "Selesai"

**Pindah kamar** — pakai handler `handlers/pindah-kamar.ts` yang sudah ada:
- baris `rooms_transfer`
- `active_tenant.no_kamar` & `kamar_id` pindah ke kamar baru
- status `kamar` lama → Kosong, baru → Terisi
- `occupancy_history` menyesuaikan

**Checkout** — pakai handler `handlers/checkout.ts` yang sudah ada:
- baris `checkout_log`
- `booking.status_booking` → 'Check-out' (trigger menghapus `active_tenant`)
- status kamar → Kosong

Keduanya JANGAN ditulis ulang di endpoint baru. Panel verifikasi hanya memanggil
logika yang sudah teruji, supaya tidak ada dua tempat yang menulis tabel sama.

## Yang masih perlu diputuskan sebelum ngoding

1. **Data yang diisi pengelola saat menandai selesai.** Checkout butuh
   pengembalian deposit, kondisi kamar, ada/tidaknya tunggakan — penghuni tidak
   mengisi itu. Apakah formnya muncul di panel, atau pengelola diarahkan ke
   modul Checkout yang sudah ada dengan data terisi otomatis?
2. **Pindah kamar & harga.** Kamar baru bisa beda tarif. Apakah pindah kamar
   memicu penyesuaian harga sewa berjalan, atau harga lama tetap sampai periode
   habis?
3. ~~Kolom status~~ — SUDAH ADA, tidak perlu migrasi. Kedua tabel punya
   `status`, `response_note`, `processed_by`, `processed_at`, dengan CHECK:
   `status IN ('Menunggu','Disetujui','Ditolak','Dibatalkan','Selesai')`.
   Pemetaan ke alur yang disepakati: Menunggu = pengajuan masuk,
   **Disetujui = "On Process"**, Selesai = data sudah berubah final.

## Catatan

Tabel sumbernya sudah ada dan sudah terisi pengajuan nyata (masing-masing 1
baris berstatus 'Menunggu' per 5 Agt 2026: pindah kamar 18 → 14 tanggal 10 Agt,
checkout kamar 18 tanggal 17 Agt).
Pola panel + endpoint bisa meniru `ReviewPendaftaranPanel.tsx` +
`api/ops/pendaftaran/route.ts` yang alurnya paling mirip (review → ubah status).
