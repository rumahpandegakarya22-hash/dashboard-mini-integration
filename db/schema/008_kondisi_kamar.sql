-- kondisi_kamar: form inspeksi kamar per siklus huni (check-in s/d check-out)
-- Satu baris = satu siklus huni. Kolom _awal diisi saat Pre-Check In,
-- _akhir diisi saat Pre-Check Out. Nilai dropdown: Baik/Perlu Perbaikan/Rusak/N/A.

CREATE TABLE IF NOT EXISTS kondisi_kamar (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  id_kamar              TEXT NOT NULL,
  no_kamar              INTEGER NOT NULL,
  id_penghuni           TEXT,
  nama_penghuni         TEXT,

  -- ---- Kondisi per item: awal (Check-In) ----
  item01_awal           TEXT CHECK (item01_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item02_awal           TEXT CHECK (item02_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item03_awal           TEXT CHECK (item03_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item04_awal           TEXT CHECK (item04_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item05_awal           TEXT CHECK (item05_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item06_awal           TEXT CHECK (item06_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item07_awal           TEXT CHECK (item07_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item08_awal           TEXT CHECK (item08_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item09_awal           TEXT CHECK (item09_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item10_awal           TEXT CHECK (item10_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item11_awal           TEXT CHECK (item11_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item12_awal           TEXT CHECK (item12_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item13_awal           TEXT CHECK (item13_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item14_awal           TEXT CHECK (item14_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item15_awal           TEXT CHECK (item15_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item16_awal           TEXT CHECK (item16_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item17_awal           TEXT CHECK (item17_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item18_awal           TEXT CHECK (item18_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item19_awal           TEXT CHECK (item19_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item20_awal           TEXT CHECK (item20_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item21_awal           TEXT CHECK (item21_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item22_awal           TEXT CHECK (item22_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item23_awal           TEXT CHECK (item23_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item24_awal           TEXT CHECK (item24_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item25_awal           TEXT CHECK (item25_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item26_awal           TEXT CHECK (item26_awal IN ('Baik','Perlu Perbaikan','Rusak','N/A')),

  -- ---- Kondisi per item: akhir (Check-Out) ----
  item01_akhir          TEXT CHECK (item01_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item02_akhir          TEXT CHECK (item02_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item03_akhir          TEXT CHECK (item03_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item04_akhir          TEXT CHECK (item04_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item05_akhir          TEXT CHECK (item05_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item06_akhir          TEXT CHECK (item06_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item07_akhir          TEXT CHECK (item07_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item08_akhir          TEXT CHECK (item08_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item09_akhir          TEXT CHECK (item09_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item10_akhir          TEXT CHECK (item10_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item11_akhir          TEXT CHECK (item11_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item12_akhir          TEXT CHECK (item12_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item13_akhir          TEXT CHECK (item13_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item14_akhir          TEXT CHECK (item14_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item15_akhir          TEXT CHECK (item15_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item16_akhir          TEXT CHECK (item16_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item17_akhir          TEXT CHECK (item17_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item18_akhir          TEXT CHECK (item18_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item19_akhir          TEXT CHECK (item19_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item20_akhir          TEXT CHECK (item20_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item21_akhir          TEXT CHECK (item21_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item22_akhir          TEXT CHECK (item22_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item23_akhir          TEXT CHECK (item23_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item24_akhir          TEXT CHECK (item24_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item25_akhir          TEXT CHECK (item25_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),
  item26_akhir          TEXT CHECK (item26_akhir IN ('Baik','Perlu Perbaikan','Rusak','N/A')),

  -- ---- Catatan & PIC ----
  catatan_awal          TEXT,
  catatan_akhir         TEXT,
  tindak_lanjut         TEXT,

  -- ---- Waktu ----
  tanggal_cek_awal      TEXT,
  tanggal_cek_akhir     TEXT,

  -- ---- PIC & approval ----
  pic                   TEXT,
  approved_checkin_by   TEXT,
  approved_checkout_by  TEXT,
  status_checkin        TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status_checkin IN ('Draft','Menunggu','Disetujui','Ditolak')),
  status_checkout       TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status_checkout IN ('Draft','Menunggu','Disetujui','Ditolak')),

  created_at            TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at            TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_kondisi_kamar_kamar ON kondisi_kamar (id_kamar);
CREATE INDEX IF NOT EXISTS idx_kondisi_kamar_penghuni ON kondisi_kamar (id_penghuni);

-- Tabel anak untuk foto per item per fase
CREATE TABLE IF NOT EXISTS kondisi_kamar_foto (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  kondisi_kamar_id  INTEGER NOT NULL REFERENCES kondisi_kamar (id) ON DELETE CASCADE,
  fase              TEXT NOT NULL CHECK (fase IN ('awal','akhir')),
  item_no           INTEGER NOT NULL CHECK (item_no BETWEEN 1 AND 26),
  url               TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_kkfoto_kondisi ON kondisi_kamar_foto (kondisi_kamar_id);
