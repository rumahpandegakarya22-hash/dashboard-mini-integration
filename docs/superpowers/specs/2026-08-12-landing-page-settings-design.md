# Workstream A — Setting Landing Page (Design)

Tanggal: 2026-08-12
Status: disetujui untuk implementasi (menunggu review spec)

## Konteks & temuan

- Admin konten landing ada di Mini App: `src/app/(ops)/ops/admin/landing-page/LandingPageAdmin.tsx` + API `src/app/api/ops/landing-page/route.ts`.
- Situs publik landing = repo terpisah `D:/Web App KTD/Landing Page Kost/kostku-landing` (Next.js 16 + Drizzle), **berbagi DB Turso yang sama**.
- Landing page **100% DB-driven** — tidak ada foto hardcoded (`public/` cuma SVG default Next.js). Sumber tiap foto:
  - Hero background = `galleryPhotos[0]` (foto galeri pertama, implisit) — via `app/_property-page.tsx` + `lib/data.ts`.
  - Galeri = `landing_gallery_photos`.
  - Poster video tour = `landing_properties.tour_video_poster_url` (fallback `gallery[0]`).
  - Kartu kamar = `landing_rooms.photo_url`.
  - Kartu fasilitas = `landing_facilities.photo_url`.
  - Location = `maps_embed_url` (iframe, bukan foto).
- API PUT sudah mendukung update semua child table (route.ts baris 61-67) — **backend edit sudah lengkap**.

## Masalah yang diselesaikan

1. Belum ada tombol Edit di 6 tab child (Kamar, Fasilitas, FAQ, Highlight, Galeri, Testimoni) — hanya Add + Delete.
2. Foto tak berlabel: user tak tahu foto mana dipakai di section mana pada landing page.
3. Hero photo tak bisa diset langsung — diam-diam mengambil foto galeri pertama.

## Keputusan (dari user)

- Hero: **buat slot "Foto Hero" khusus** (independen dari urutan galeri).
- Input foto: **tetap paste URL** + tambahkan preview thumbnail (belum ada upload file).

## Perubahan

### A1 — Tombol Edit (Mini App saja)
- File: `LandingPageAdmin.tsx`, komponen `ChildTable`.
- Tambah tombol pensil Edit per baris. Klik → buka form (reuse `addFields`) terisi nilai baris, mode "edit" → `apiCall('PUT', { table, id, data })`.
- Satu form melayani add & edit (state `editingId`). Tanpa backend/schema baru.

### A2 — Label lokasi foto + preview
- Perkaya field def dengan `hint?: string` dan `preview?: boolean`.
- Render caption + `<img>` thumbnail URL saat ini, di form add & edit.
- Peta caption:
  - Kamar `photo_url`: "Foto kartu kamar — section Pilihan Kamar. Rasio 4:3."
  - Fasilitas `photo_url`: "Foto kartu fasilitas — section Fasilitas. Rasio 4:3."
  - Galeri `url`: "Foto grid galeri — section Galeri."
  - Info Umum `tour_video_poster_url`: "Poster sebelum video tour diputar. Rasio 16:9."
  - Info Umum `hero_photo_url`: "Foto latar hero (paling atas). Rasio 16:9 landscape."

### A3 — Slot Hero khusus (satu sentuhan cross-repo)
- Migrasi Mini App `db/schema/012_landing_hero_photo.sql`:
  `ALTER TABLE landing_properties ADD COLUMN hero_photo_url TEXT NOT NULL DEFAULT '';`
- Mini App admin: tambah `hero_photo_url` ke `PROP_FIELDS` (Info Umum) dengan hint + preview.
- Repo landing (`kostku-landing`):
  - `lib/db/schema.ts`: tambah `heroPhotoUrl: text("hero_photo_url").notNull().default("")` di `landingProperties`.
  - `lib/data.ts`: expose `heroPhotoUrl` di property mapping.
  - `app/_property-page.tsx`: `const heroPhoto = data.property.heroPhotoUrl ? { id: 'hero', src: data.property.heroPhotoUrl, alt: ... } : data.galleryPhotos[0];`

## Di luar scope (sengaja)

- Admin terpisah milik repo landing (`app/admin/[propertySlug]/...`) — tidak disentuh.
- Upload file foto — tidak; tetap paste URL.
- Workstream B (UI polish) & C (akuntansi) — terpisah.

## Verifikasi

- Mini App: jalankan dev server, buka admin landing-page, uji Edit di tiap tab child, cek preview thumbnail muncul, simpan hero_photo_url.
- Landing: `heroPhoto` memakai `hero_photo_url` bila diisi, fallback ke galeri[0] bila kosong.
