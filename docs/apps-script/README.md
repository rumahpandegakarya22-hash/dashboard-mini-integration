# Apps Script — Integrasi Invoice Mini App

Dua file `.gs` di folder ini adalah `doPost` yang bikin tombol **Konfirmasi & Kirim** di modul Pembayaran Sewa otomatis mengirim invoice PDF ke email penghuni.

**Revisi arsitektur:** Apps Script sekarang **baca data invoice langsung dari Turso** (bukan lagi menerima data mentah di payload) dan **generate PDF dari template Google Docs** (bukan lagi bergantung ke fungsi generate lama di spreadsheet yang sudah ada, yang keberadaannya belum tentu jelas). Alurnya:

1. Mini app tulis baris `invoice_sewa`/`invoice_dp` + `payment` ke Turso **DULU**.
2. Mini app POST `{ token, mode: 'send', input: { noInv } }` ke Web App ini — payload cuma berisi nomor invoice, bukan data lengkap.
3. Apps Script verifikasi token, lalu **query Turso via HTTP API** pakai `noInv` itu untuk ambil data lengkap (nama, email, harga, dst).
4. Copy template Google Docs invoice, isi placeholder `{{...}}`, export jadi PDF.
5. Kirim PDF ke email penghuni, catat status di sheet "Log Invoice Mini App".
6. Balas `{ success, noInv, email }` ke mini app, ditampilkan di layar sukses.

| File | Tempel ke | Env yang harus cocok |
|---|---|---|
| `invoice-sewa.gs` | Spreadsheet **Invoice Pembayaran Sewa** → Extensions → Apps Script | `APPS_SCRIPT_INVOICE_SEWA_URL`, `APPS_SCRIPT_TOKEN` |
| `invoice-dp.gs` | Spreadsheet **Invoice Pembayaran DP** → Extensions → Apps Script | `APPS_SCRIPT_INVOICE_DP_URL`, `APPS_SCRIPT_TOKEN` |

## Langkah pasang (per file)

1. **Buat template invoice** di Google Docs. Isi placeholder PERSIS seperti daftar `REPLACEMENTS_` di dalam file `.gs` masing-masing, contoh: `{{NAMA}}`, `{{NO_KAMAR}}`, `{{GRAND_TOTAL}}`, dst — desain grafisnya (logo, layout, warna) bebas, placeholder itu teks biasa di dalam Doc. Salin ID file dari URL (`https://docs.google.com/document/d/<ID>/edit`).
2. Tempel isi `.gs` sebagai file script baru — **jangan menimpa** script lama yang masih dipakai menu manual (kalau ada).
3. Project Settings → **Script properties** → tambah:
   - `MINIAPP_TOKEN` — sama persis dengan `APPS_SCRIPT_TOKEN` di `.env.local`/Vercel.
   - `TURSO_HTTP_URL` — nilai `TURSO_DATABASE_URL` tapi skema `libsql://` diganti `https://` (mis. `libsql://kost-abc.turso.io` → `https://kost-abc.turso.io`).
   - `TURSO_READONLY_TOKEN` — token Turso **read-only**, BUKAN token read-write yang dipakai mini app. Buat dengan `turso db tokens create <nama-db> --read-only` (CLI Turso) supaya kalau token ini bocor, tidak bisa dipakai menulis/menghapus data produksi.
   - `TEMPLATE_DOC_ID_SEWA` (atau `TEMPLATE_DOC_ID_DP`) — ID template dari langkah 1.
   - `DRIVE_FOLDER_ID_SEWA` (atau `DRIVE_FOLDER_ID_DP`) — opsional, ID folder Drive kalau mau PDF invoice disimpan permanen (kalau kosong, file copy Docs sementara otomatis dihapus setelah PDF terkirim).
4. **Deploy → New deployment → Web app** → *Execute as: Me*, *Who has access: Anyone* → salin URL `/exec` ke env var URL yang sesuai. Perubahan kode berikutnya cukup **New version** pada deployment yang sama (URL tidak berubah).

## Prasyarat lain (sekali saja)

Kalau kedua file `.gs` (Sewa & DP) ditempel di **project Apps Script yang sama** (mis. keduanya jadi tab di satu spreadsheet), fungsi `tursoQuery_`, `rupiah_`, `logInvoiceRow_`, `updateLogStatus_`, `jsonOut_` isinya identik di kedua file — hapus salah satu duplikatnya supaya tidak bentrok nama fungsi.

## Kontrak request/response

Mini app mengirim `POST` JSON: `{ token, mode: 'send', input: { noInv } }` — `noInv` adalah nomor invoice yang barusan ditulis mini app ke Turso.

Balasan yang diharapkan app: `{ success: true, noInv, email }` atau `{ success: false, error }`. Kegagalan trigger **tidak membatalkan** pencatatan pembayaran di ledger (best-effort, sesuai PRD §6 Modul 2) — statusnya ditampilkan di layar sukses.
