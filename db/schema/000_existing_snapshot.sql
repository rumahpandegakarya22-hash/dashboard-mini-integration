-- =========================================================================
-- Snapshot skema Turso PRODUKSI apa adanya (auto-generate dari sqlite_master).
-- Dokumentasi saja: skema selama ini dikelola langsung di Turso, tidak pernah
-- ada di repo. JANGAN dijalankan untuk membuat ulang DB produksi.
-- Dibuat: 2026-07-21
-- =========================================================================

CREATE TRIGGER trg_booking_checkin_ins
AFTER INSERT ON booking WHEN NEW.status_booking = 'Check-in'
BEGIN
  UPDATE booking SET id_penghuni = printf('KTD-%s-%03d', substr(strftime('%Y%m', COALESCE(NEW.tgl_masuk, NEW.tanggal_booking, 'now')), 3), COALESCE((
      SELECT MAX(CAST(substr(id_penghuni, -3) AS INTEGER)) FROM (
        SELECT id_penghuni FROM occupancy_history
        UNION ALL SELECT id_penghuni FROM booking WHERE id_penghuni IS NOT NULL
      ) WHERE substr(id_penghuni, 5, 4) = substr(strftime('%Y%m', COALESCE(NEW.tgl_masuk, NEW.tanggal_booking, 'now')), 3)), 0) + 1)
   WHERE no_booking = NEW.no_booking AND (NEW.id_penghuni IS NULL OR NEW.id_penghuni = '');
  INSERT INTO occupancy_history (id_penghuni, nama, no_kamar, tanggal_mulai, tanggal_selesasi, status)
  SELECT b.id_penghuni, NEW.nama_penyewa, CAST(NEW.kamar_no AS TEXT),
         COALESCE(NEW.tgl_masuk, NEW.tanggal_booking, date('now')), NULL, 'Check-in'
    FROM booking b WHERE b.no_booking = NEW.no_booking
  ON CONFLICT(id_penghuni) DO UPDATE SET
    status='Check-in', tanggal_selesasi=NULL, nama=excluded.nama,
    no_kamar=excluded.no_kamar, tanggal_mulai=excluded.tanggal_mulai;
  INSERT INTO active_tenant (kamar_id, no_kamar, nama_lengkap, no_hp, tanggal_masuk, id_penghuni)
  SELECT 'KTD-'||NEW.kamar_no, CAST(NEW.kamar_no AS TEXT), NEW.nama_penyewa, NEW.no_hp,
         COALESCE(NEW.tgl_masuk, NEW.tanggal_booking), b.id_penghuni
    FROM booking b WHERE b.no_booking = NEW.no_booking
  ON CONFLICT(kamar_id) DO UPDATE SET
    nama_lengkap=excluded.nama_lengkap, no_hp=excluded.no_hp,
    tanggal_masuk=excluded.tanggal_masuk, id_penghuni=excluded.id_penghuni,
    updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER trg_booking_checkin_upd
AFTER UPDATE OF status_booking ON booking
WHEN NEW.status_booking = 'Check-in' AND (OLD.status_booking IS NULL OR OLD.status_booking <> 'Check-in')
BEGIN
  UPDATE booking SET id_penghuni = printf('KTD-%s-%03d', substr(strftime('%Y%m', COALESCE(NEW.tgl_masuk, NEW.tanggal_booking, 'now')), 3), COALESCE((
      SELECT MAX(CAST(substr(id_penghuni, -3) AS INTEGER)) FROM (
        SELECT id_penghuni FROM occupancy_history
        UNION ALL SELECT id_penghuni FROM booking WHERE id_penghuni IS NOT NULL
      ) WHERE substr(id_penghuni, 5, 4) = substr(strftime('%Y%m', COALESCE(NEW.tgl_masuk, NEW.tanggal_booking, 'now')), 3)), 0) + 1)
   WHERE no_booking = NEW.no_booking AND (NEW.id_penghuni IS NULL OR NEW.id_penghuni = '');
  INSERT INTO occupancy_history (id_penghuni, nama, no_kamar, tanggal_mulai, tanggal_selesasi, status)
  SELECT b.id_penghuni, NEW.nama_penyewa, CAST(NEW.kamar_no AS TEXT),
         COALESCE(NEW.tgl_masuk, NEW.tanggal_booking, date('now')), NULL, 'Check-in'
    FROM booking b WHERE b.no_booking = NEW.no_booking
  ON CONFLICT(id_penghuni) DO UPDATE SET
    status='Check-in', tanggal_selesasi=NULL, nama=excluded.nama,
    no_kamar=excluded.no_kamar, tanggal_mulai=excluded.tanggal_mulai;
  INSERT INTO active_tenant (kamar_id, no_kamar, nama_lengkap, no_hp, tanggal_masuk, id_penghuni)
  SELECT 'KTD-'||NEW.kamar_no, CAST(NEW.kamar_no AS TEXT), NEW.nama_penyewa, NEW.no_hp,
         COALESCE(NEW.tgl_masuk, NEW.tanggal_booking), b.id_penghuni
    FROM booking b WHERE b.no_booking = NEW.no_booking
  ON CONFLICT(kamar_id) DO UPDATE SET
    nama_lengkap=excluded.nama_lengkap, no_hp=excluded.no_hp,
    tanggal_masuk=excluded.tanggal_masuk, id_penghuni=excluded.id_penghuni,
    updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER trg_booking_checkout_upd
AFTER UPDATE OF status_booking ON booking
WHEN NEW.status_booking = 'Check-out' AND (OLD.status_booking IS NULL OR OLD.status_booking <> 'Check-out')
 AND NEW.id_penghuni IS NOT NULL AND NEW.id_penghuni <> ''
BEGIN
  UPDATE occupancy_history SET status='Check-out',
    tanggal_selesasi = COALESCE(NEW.tgl_keluar_est, date('now'))
  WHERE id_penghuni = NEW.id_penghuni;
  DELETE FROM active_tenant WHERE id_penghuni = NEW.id_penghuni;
END;

CREATE TABLE "active_tenant" (
	"kamar_id" text PRIMARY KEY REFERENCES "kamar"("id_kamar"),
	`email` text UNIQUE,
	`nama_lengkap` text NOT NULL,
	`nama_panggilan` text,
	`no_kamar` text,
	`pekerjaan` text,
	`instansi` text,
	`no_hp` text,
	`nomor_darurat_1` text,
	`hubungan_kontak_darurat_1` text,
	`nama_kontak_darurat_1` text,
	`nomor_darurat_2` text,
	`hubungan_kontak_darurat_2` text,
	`nama_kontak_darurat_2` text,
	`tanggal_lahir` text,
	`link_identitas` text,
	`asal_daerah` text,
	`tanggal_masuk` text,
	`created_at` numeric DEFAULT CURRENT_TIMESTAMP,
	`updated_at` numeric DEFAULT CURRENT_TIMESTAMP,
	"id_penghuni" text UNIQUE,
	FOREIGN KEY("id_penghuni") REFERENCES "occupancy_history"("id_penghuni")
);

CREATE TABLE booking (
  no_booking          TEXT PRIMARY KEY,
  id_penghuni         TEXT REFERENCES occupancy_history(id_penghuni) DEFERRABLE INITIALLY DEFERRED,
  tanggal_booking     TEXT,
  nama_penyewa        TEXT,
  no_hp               TEXT,
  kamar_no            INTEGER REFERENCES kamar(no_kamar),
  tgl_masuk           TEXT,
  durasi_bulan        INTEGER,
  tgl_keluar_est      TEXT,
  harga_disepakati    INTEGER,
  status_booking      TEXT,
  alasan_cancel       TEXT,
  sumber_leads        TEXT,
  catatan             TEXT
);

CREATE TABLE coa (
  kode                INTEGER PRIMARY KEY,
  nama_akun           TEXT NOT NULL UNIQUE,
  tipe_akun           TEXT,
  saldo_normal        TEXT,   
  kategori_arus_kas   TEXT,
  grup_laporan        TEXT
);

CREATE TABLE content (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tgl_post       TEXT,     
  platform       TEXT,
  tipe_konten    TEXT,
  judul_caption  TEXT,
  jam_tayang     TEXT,     
  link_post      TEXT,
  jam            TEXT,     
  status         TEXT,
  likes          INTEGER,
  komentar       INTEGER,
  share_saves    INTEGER,
  reach          INTEGER,
  catatan        TEXT,
  engagement     INTEGER,
  er_persen      REAL      
);

CREATE TABLE daily_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal TEXT NOT NULL,         -- Disarankan format YYYY-MM-DD (contoh: 2026-06-23)
    task TEXT NOT NULL,
    pic TEXT NOT NULL,
    divisi TEXT NOT NULL CHECK(divisi IN ('Admin', 'Cleaning', 'Finance', 'Inspeksi', 'Maintenance', 'Marketing', 'Sales')),
    deadline TEXT NOT NULL,       -- Disarankan format YYYY-MM-DD
    status TEXT NOT NULL CHECK(status IN ('Pending', 'In Progress', 'Complete')) DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dokumen (
  id_dokumen   TEXT PRIMARY KEY,   
  judul        TEXT,
  role         TEXT,
  link_drive   TEXT
);

CREATE TABLE feedback (
    id_feedback INTEGER PRIMARY KEY AUTOINCREMENT,
    id_penghuni TEXT NOT NULL,
    nama TEXT NOT NULL,
    no_kamar INTEGER NOT NULL REFERENCES kamar(no_kamar),
    category TEXT NOT NULL CHECK(category IN ('Internet', 'Listrik', 'Air', 'AC', 'kebersihan', 'Keamanan', 'Fasilitas', 'Pelayanan', 'Lainnya')),
    deskripsi TEXT,
    status TEXT,
    FOREIGN KEY (id_penghuni) REFERENCES occupancy_history(id_penghuni)
);

CREATE TABLE invoice_dp (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    no_inv              TEXT NOT NULL UNIQUE,
    id_penghuni         TEXT REFERENCES occupancy_history(id_penghuni),
    nama                TEXT NOT NULL,
    email               TEXT,
    tanggal_pembayaran  TEXT,
    no_kamar            TEXT NOT NULL,
    tipe_kamar          TEXT,
    jumlah              INTEGER DEFAULT 1,
    harga_kamar         INTEGER,
    subtotal            INTEGER,
    pajak               INTEGER,
    diskon              INTEGER,
    grand_total         INTEGER NOT NULL,
    checked             INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT DEFAULT (CURRENT_TIMESTAMP)
  );

CREATE TABLE invoice_sewa (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  no_inv              TEXT NOT NULL,
  id_penghuni         TEXT REFERENCES occupancy_history(id_penghuni), -- nullable: sheet gak punya kolom id, backfill via UPDATE di bawah
  nama                TEXT NOT NULL,
  email               TEXT,
  tanggal_pembayaran  TEXT,                       -- 'YYYY-MM-DD', NULL = belum bayar
  periode_awal        TEXT,                       -- 'YYYY-MM-DD'
  periode_akhir       TEXT,                       -- 'YYYY-MM-DD'
  no_kamar            TEXT NOT NULL,
  jumlah_bulan        INTEGER,                    -- kolom "Jumlah" di sheet = jumlah bulan sewa
  jumlah_denda        INTEGER,                    -- kolom "Jumlah Denda" = qty denda
  harga_sewa          INTEGER,                    -- kolom "Sewa" = tarif per bulan
  tambahan_listrik    INTEGER,                    -- tarif listrik per bulan
  denda               INTEGER,                    -- tarif denda per unit
  total_sewa          INTEGER,                    -- harga_sewa x jumlah_bulan
  total_listrik       INTEGER,                    -- tambahan_listrik x jumlah_bulan
  total_denda         INTEGER,                    -- denda x jumlah_denda
  diskon              INTEGER,
  pajak               INTEGER,
  subtotal            INTEGER,
  grand_total         INTEGER,                    -- total_sewa + total_listrik + total_denda - diskon + pajak
  tipe_kamar          TEXT,
  checked             INTEGER NOT NULL DEFAULT 0, -- 0/1, kolom checkbox "Check" di sheet
  created_at          TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE jurnal_transaksi (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal            TEXT,     
  akun_debit_kode    INTEGER REFERENCES coa(kode),
  akun_kredit_kode   INTEGER REFERENCES coa(kode),
  nominal            INTEGER,
  keterangan         TEXT,
  kategori           TEXT
);

CREATE TABLE kamar (
  id_kamar        TEXT PRIMARY KEY,       
  no_kamar        INTEGER NOT NULL UNIQUE,
  tipe_kamar      TEXT,
  luas_m2         REAL,
  lantai          INTEGER,
  fasilitas       TEXT,
  harga_bulan     INTEGER,
  harga_3bulan    INTEGER,
  harga_6bulan    INTEGER,
  harga_9bulan    INTEGER,
  harga_tahun     INTEGER,
  status          TEXT,
  catatan         TEXT
);

CREATE TABLE leads (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,  
  tanggal             TEXT,      
  nama_leads          TEXT,
  no_hp_wa            TEXT,
  sumber_leads        TEXT,
  platform            TEXT,
  kamar_dicari        TEXT,      
  budget              INTEGER,
  checkin_rencana     TEXT,      
  status_leads        TEXT,
  tindak_lanjut       TEXT,
  pic                 TEXT,
  tanggal_fu          TEXT,      
  keterangan          TEXT
);

CREATE TABLE logbook_divisi (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal    TEXT,     
  task       TEXT,
  pic        TEXT,     
  divisi     TEXT,
  deadline   TEXT,     
  status     TEXT
);

CREATE TABLE maintenance_cm (
  id_tiket                TEXT PRIMARY KEY,   
  no_urut                 INTEGER,
  tanggal_kerusakan       TEXT,   
  tanggal_lapor           TEXT,   
  tanggal_selesai         TEXT,   
  sumber_laporan          TEXT,
  lokasi_item             TEXT,
  kategori                TEXT,
  penyebab                TEXT,
  kode                    TEXT,
  deskripsi_kerusakan     TEXT,
  prioritas               TEXT,
  pelaksana               TEXT,
  vendor                  TEXT,   
  biaya                   INTEGER,
  status                  TEXT,
  catatan_dokumentasi     TEXT,
  durasi_perbaikan_hari   INTEGER,
  sla                     TEXT
);

CREATE TABLE maintenance_pm (
  id_tiket                TEXT PRIMARY KEY,   
  no_urut                 INTEGER,
  tanggal_lapor           TEXT,   
  tanggal_selesai         TEXT,   
  sumber_laporan          TEXT,   
  lokasi_item             TEXT,   
  kategori                TEXT,
  penyebab                TEXT,
  kode                    TEXT,
  deskripsi_kerusakan     TEXT,
  prioritas               TEXT,
  pelaksana               TEXT,
  vendor                  TEXT,
  biaya                   INTEGER,
  status                  TEXT,
  catatan_dokumentasi     TEXT,
  durasi_perbaikan_hari   INTEGER,
  sla                     TEXT
);

CREATE TABLE occupancy_history (
    id_penghuni TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    no_kamar TEXT NOT NULL,
    tanggal_mulai TEXT NOT NULL, -- Format standard SQLite untuk tanggal: YYYY-MM-DD
    tanggal_selesasi TEXT
, status TEXT);

CREATE TABLE "payment" (
    id_payment       TEXT PRIMARY KEY,
    id_penghuni      TEXT NOT NULL REFERENCES occupancy_history(id_penghuni),
    invoice_dp_id    INTEGER REFERENCES invoice_dp(id),
    invoice_sewa_id  INTEGER REFERENCES invoice_sewa(id),
    periode_awal     TEXT,
    periode_akhir    TEXT,
    amount           REAL NOT NULL,
    payment_date     TEXT,
    payment_method   TEXT CHECK(payment_method IN ('Transfer','Qris','Cash')),
    status           TEXT NOT NULL CHECK(status IN ('Pending','Paid','Partial','Overdue','Cancelled','Refund')),
    notes            TEXT,
    created_at       TEXT DEFAULT (CURRENT_TIMESTAMP),
    CHECK ((invoice_dp_id IS NOT NULL) + (invoice_sewa_id IS NOT NULL) = 1)
  );

CREATE TABLE promotion (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tgl_mulai           TEXT,     
  tgl_selesai         TEXT,     
  nama_promosi        TEXT,
  platform            TEXT,
  tipe                TEXT,
  budget              INTEGER,
  spend_aktual        INTEGER,
  target_leads        INTEGER,
  leads_aktual        INTEGER,
  booking_dr_promo    INTEGER,
  roi_persen          REAL,
  status              TEXT,
  cpl                 INTEGER,
  conv_lead_booking   REAL,
  roi_kotor           REAL
);

CREATE TABLE rooms_transfer (
    id_rooms_transfer TEXT PRIMARY KEY,
    id_penghuni TEXT NOT NULL,
    no_kamar_lama INTEGER NOT NULL REFERENCES kamar(no_kamar),
    no_kamar_baru INTEGER NOT NULL REFERENCES kamar(no_kamar),
    tanggal TEXT NOT NULL,
    alasan TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (id_penghuni) REFERENCES occupancy_history(id_penghuni)
);

CREATE TABLE survey (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  id_survey           TEXT,      
  tanggal_survey      TEXT,      
  nama_calon_penyewa  TEXT,
  no_hp               TEXT,
  sumber              TEXT,
  kamar_ditinjau      TEXT,
  jam_survey          TEXT,
  durasi_menit        INTEGER,
  feedback            TEXT,
  keberatan_kendala   TEXT,
  hasil_survey        TEXT,
  tindak_lanjut       TEXT,
  pic                 TEXT,
  tanggal_fu_survey   TEXT,      
  no_booking          TEXT REFERENCES booking(no_booking)
);

CREATE TABLE tenant_complain (
    id_complain TEXT PRIMARY KEY,
    id_penghuni TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Internet', 'Listrik', 'Air', 'AC', 'kebersihan', 'Keamanan', 'Fasilitas', 'Pelayanan', 'Lainnya')),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    reported_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    resolved_at TEXT,
    FOREIGN KEY (id_penghuni) REFERENCES occupancy_history(id_penghuni)
);

CREATE TABLE tenant_docs (
    id_docs TEXT PRIMARY KEY,
    id_penghuni TEXT NOT NULL,
    doc_type TEXT NOT NULL CHECK(doc_type IN ('KTP', 'SIM', 'Paspor', 'KTM', 'KK', 'Surat Kontrak', 'Surat Jaminan')),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    upload_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    upload_by TEXT,
    notes TEXT,
    FOREIGN KEY (id_penghuni) REFERENCES occupancy_history(id_penghuni)
);

CREATE TABLE vendor (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,  
  nama_vendor   TEXT,
  kategori      TEXT,
  nomor_telp    TEXT,
  hasil         TEXT
);

CREATE TABLE "work_orders" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tanggal_input TEXT NOT NULL,
    petugas TEXT NOT NULL,
    divisi_asal TEXT NOT NULL CHECK(divisi_asal IN ('Inspeksi','Cleaning','Maintenance')),
    lokasi_item TEXT NOT NULL,
    kategori TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    prioritas TEXT NOT NULL CHECK(prioritas IN ('Tinggi','Sedang','Rendah','Darurat')),
    tujuan_divisi TEXT NOT NULL CHECK(tujuan_divisi IN ('Cleaning','Maintenance','Inspeksi','Admin')),
    target_deadline TEXT, catatan TEXT, bukti_foto_url TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','In Progress','Complete')),
    created_by TEXT, created_at TEXT DEFAULT (CURRENT_TIMESTAMP), updated_at TEXT,
    pic TEXT, completed_by TEXT,
    nominal INTEGER,
    ref_tiket TEXT
  );

CREATE INDEX idx_invoice_dp_penghuni ON invoice_dp(id_penghuni);

CREATE INDEX idx_invoice_sewa_no_inv   ON invoice_sewa(no_inv);

CREATE INDEX idx_jurnal_debit ON jurnal_transaksi (akun_debit_kode);

CREATE INDEX idx_jurnal_kredit ON jurnal_transaksi (akun_kredit_kode);

CREATE INDEX idx_jurnal_tanggal ON jurnal_transaksi (tanggal);

CREATE INDEX idx_payment_invoice_dp ON payment(invoice_dp_id);

CREATE INDEX idx_payment_invoice_sewa ON payment(invoice_sewa_id);

CREATE INDEX idx_payment_penghuni ON payment(id_penghuni);

CREATE INDEX idx_tasks_divisi_tanggal ON daily_tasks(divisi, tanggal);
