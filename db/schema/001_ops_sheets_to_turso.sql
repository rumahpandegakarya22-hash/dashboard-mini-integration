-- =========================================================================
-- Migrasi Mini App Ops: Google Sheets → Turso (Wave 0 — skema)
--
-- Objek BARU yang dibutuhkan supaya modul Ops bisa read+write ke Turso tanpa
-- lagi menyentuh Google Sheets. Tabel yang SUDAH ada (booking, survey, leads,
-- content, promotion, payment, invoice_sewa, invoice_dp, kamar, active_tenant,
-- occupancy_history, dst) TIDAK disentuh di sini — lihat 000_existing_snapshot.sql.
--
-- Konvensi mengikuti tabel eksisting: tanggal disimpan TEXT 'YYYY-MM-DD',
-- timestamp TEXT via CURRENT_TIMESTAMP, uang INTEGER rupiah penuh.
-- Aman dijalankan ulang (IF NOT EXISTS).
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. settings — pengganti tab SETTING di berbagai spreadsheet.
--    Dipakai master 'setting:<GRUP>:SETTING:<Kolom>' (lihat getGenericSettingOptions).
--    `grup` memakai kunci lama SHEETS (LOG_SALES, LOG_MARKETING, ...) supaya
--    string master di registry.ts tidak perlu diubah saat migrasi.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  grup    TEXT NOT NULL,               -- mis. 'LOG_SALES', 'LOG_MARKETING'
  kolom   TEXT NOT NULL,               -- mis. 'Dari Mana', 'Hasil Survey'
  nilai   TEXT NOT NULL,
  urutan  INTEGER NOT NULL DEFAULT 0,  -- jaga urutan tampil dropdown
  aktif   INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
  UNIQUE (grup, kolom, nilai)
);

CREATE INDEX IF NOT EXISTS idx_settings_lookup ON settings (grup, kolom, aktif, urutan);

-- -------------------------------------------------------------------------
-- 2. inspeksi_fasilitas — modul 'inspeksi-fasilitas'
--    (dulu: LOG_INSPEKSI_PERAWATAN, tab 'Log Inspeksi Harian' B:H)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspeksi_fasilitas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal             TEXT NOT NULL,
  area_fasilitas      TEXT NOT NULL,
  kondisi_ditemukan   TEXT NOT NULL,
  kategori            TEXT NOT NULL,
  tindak_lanjut_perlu TEXT NOT NULL,
  petugas             TEXT NOT NULL,
  catatan             TEXT,
  created_at          TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_inspeksi_fasilitas_tanggal ON inspeksi_fasilitas (tanggal);

-- -------------------------------------------------------------------------
-- 3. inspeksi_kebersihan — modul 'inspeksi-kebersihan'
--    (dulu: LOGBOOK_INSPEKSI_KEBERSIHAN)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspeksi_kebersihan (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal       TEXT NOT NULL,
  area          TEXT NOT NULL,
  hasil_kondisi TEXT NOT NULL,
  temuan        TEXT,
  tindak_lanjut TEXT,
  petugas       TEXT NOT NULL,
  created_at    TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_inspeksi_kebersihan_tanggal ON inspeksi_kebersihan (tanggal);

-- -------------------------------------------------------------------------
-- 4. checkout_log — modul 'checkout' (dulu: spreadsheet CHECKOUT, tab 'Log Checkout').
--    Efek lain checkout (occupancy_history.status='Check-out' + tanggal_selesasi,
--    kamar.status='Kosong') memakai tabel yang SUDAH ada; tabel ini menampung
--    data yang tidak punya rumah di sana: deposit, kondisi kamar, tunggakan.
--    id_penghuni nullable: label penghuni bisa gagal di-resolve ke occupancy_history.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkout_log (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  id_penghuni          TEXT REFERENCES occupancy_history (id_penghuni),
  penghuni_label       TEXT NOT NULL,          -- format baku "KTD-x — Nama"
  no_kamar             TEXT NOT NULL,
  tanggal_checkout     TEXT NOT NULL,
  tgl_masuk            TEXT,
  ada_tunggakan        TEXT NOT NULL CHECK (ada_tunggakan IN ('Ya', 'Tidak')),
  nominal_tunggakan    INTEGER NOT NULL DEFAULT 0,
  pengembalian_deposit INTEGER NOT NULL DEFAULT 0,
  kondisi_kamar        TEXT NOT NULL CHECK (kondisi_kamar IN ('Baik', 'Perlu Perbaikan', 'Rusak')),
  catatan_kerusakan    TEXT,
  diinput_oleh         TEXT,
  created_at           TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_checkout_log_tanggal ON checkout_log (tanggal_checkout);

-- -------------------------------------------------------------------------
-- 5. audit_log — pengganti spreadsheet AUDIT_LOG tab 'Log'!A:M (13 kolom).
--    Urutan kolom sengaja mengikuti writeAudit() di src/lib/core/audit.ts.
--    row_ref: dulu nomor baris sheet; setelah migrasi diisi id baris Turso.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  request_id   TEXT,
  username     TEXT,
  role         TEXT,
  module_id    TEXT,
  action       TEXT CHECK (action IN ('CREATE', 'UPDATE')),
  target       TEXT,
  row_ref      INTEGER,
  old_data     TEXT,                    -- JSON string
  new_data     TEXT,                    -- JSON string
  duration_sec REAL,
  status       TEXT CHECK (status IN ('sukses', 'gagal')),
  error        TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log (ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_module ON audit_log (module_id, ts);

-- -------------------------------------------------------------------------
-- 6. invoice_harga — DIBATALKAN, lihat 002_drop_invoice_harga.sql.
--    Ternyata MUBAZIR: tabel `kamar` sudah punya matriks harga x durasi
--    (harga_bulan / harga_3bulan / harga_6bulan / harga_9bulan / harga_tahun),
--    dan angkanya cocok dgn invoice nyata. DP bukan kolom, tapi turunan:
--    50% dari harga 1 bulan.
-- -------------------------------------------------------------------------

-- -------------------------------------------------------------------------
-- 7. kamar.listrik — tarif listrik/bulan per kamar.
--    Dulu dibaca dari DATABASE_PENGHUNI tab 'DATA' kolom "Listrik" (sheet
--    READ-ONLY berformula/IMPORTRANGE) via getListrikByKamar().
--    SQLite tidak punya "ADD COLUMN IF NOT EXISTS" — baris ini akan error
--    "duplicate column name" bila dijalankan dua kali; itu aman diabaikan.
-- -------------------------------------------------------------------------
ALTER TABLE kamar ADD COLUMN listrik INTEGER;
