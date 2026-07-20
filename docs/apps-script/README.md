# Apps Script — Integrasi Invoice Mini App

Dua file `.gs` di folder ini adalah jembatan `doPost` agar tombol **Konfirmasi & Kirim** di modul Pembayaran Sewa:

1. Mencatat pembayaran ke **Log Input Transaksi → Input Sewa Dimuka** (sudah jalan di app),
2. **Menulis data ke file spreadsheet Invoice** (baris baru di sheet "Log Invoice Mini App", dibuat otomatis),
3. **Men-trigger Apps Script** di file itu untuk generate + kirim invoice ke email penghuni,
4. Menampilkan hasilnya (No. Invoice + email tujuan) di layar sukses mini app.

| File | Tempel ke | Env yang harus cocok |
|---|---|---|
| `invoice-sewa.gs` | Spreadsheet **Invoice Pembayaran Sewa** → Extensions → Apps Script | `APPS_SCRIPT_INVOICE_SEWA_URL`, `APPS_SCRIPT_TOKEN` |
| `invoice-dp.gs` | Spreadsheet **Invoice Pembayaran DP** → Extensions → Apps Script | `APPS_SCRIPT_INVOICE_DP_URL`, `APPS_SCRIPT_TOKEN` |

## Langkah pasang (per file)

1. Tempel isi `.gs` sebagai file script baru — **jangan menimpa** script yang sudah ada.
2. Edit fungsi `kirimInvoiceDariMiniApp_()` — hubungkan ke fungsi generate+kirim yang selama ini dipakai tombol/menu manual (contoh pola ada di komentar fungsi). Ini satu-satunya bagian yang perlu disesuaikan.
3. Project Settings → **Script properties** → tambah `MINIAPP_TOKEN`, isi sama persis dengan `APPS_SCRIPT_TOKEN` di `.env.local` / Vercel.
4. **Deploy → New deployment → Web app** → *Execute as: Me*, *Who has access: Anyone* → salin URL `/exec` ke env var URL yang sesuai. Perubahan kode berikutnya cukup **New version** pada deployment yang sama (URL tidak berubah).

## Prasyarat lain (sekali saja)

Share kedua file Invoice ke service account **sebagai Editor**:

```
miniapp@mini-app-kost-tiga-dara.iam.gserviceaccount.com
```

Tanpa ini, mini app tidak bisa membaca master harga/penghuni dari file Invoice — layar **Preview** untuk jenis Sewa/DP akan error "The caller does not have permission" sebelum sempat kirim apa pun.

## Kontrak request/response

Mini app mengirim `POST` JSON: `{ token, mode: 'send', input }`.

- `input` Sewa: `nama, email, noKamar, tipe, lamaSewa, tglPembayaran, periodeAwal, dendaPerUnit, jumlahDenda, pajak, diskon`
- `input` DP: `nama, noKamar, tglPembayaran, pajak, diskon`

Balasan yang diharapkan app: `{ success: true, noInv, email }` atau `{ success: false, error }`. Kegagalan trigger **tidak membatalkan** pencatatan pembayaran di ledger (best-effort, sesuai PRD §6 Modul 2) — statusnya ditampilkan di layar sukses.
