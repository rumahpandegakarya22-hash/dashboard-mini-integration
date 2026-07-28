-- =========================================================================
-- Integrasi fitur pengelola Teman Rara ke Mini Apps Ops.
--
-- Konteks: aplikasi penghuni "Teman Rara" menulis ke database yang SAMA
-- (tabel prefix tr_* + tenant_complain). Beberapa tugas pengelola belum punya
-- UI di mana pun — lihat PLANNING-INTEGRASI-TEMAN-RARA-OPS.md.
--
-- Migrasi ini HANYA menambah kolom nullable. Tidak ada kolom yang dihapus,
-- di-rename, atau berubah tipe → backward compatible penuh; aplikasi Teman
-- Rara yang belum tahu kolom-kolom ini tetap jalan apa adanya.
--
-- Rollback: ALTER TABLE <tabel> DROP COLUMN <kolom> untuk tiap kolom di bawah,
-- lalu kembalikan baris settings 'Review' ke aktif = 1.
--
-- Aman dijalankan ulang: apply-schema.ts melewati error "duplicate column name".
-- =========================================================================

-- -------------------------------------------------------------------------
-- S1. Tanggapan pengaduan.
--     Sebelumnya pengelola hanya bisa mengubah `status`, jadi penghuni melihat
--     status berpindah tanpa penjelasan apa pun. Tiga kolom ini membuat balasan
--     pengelola bisa ditampilkan di aplikasi penghuni.
-- -------------------------------------------------------------------------
ALTER TABLE tenant_complain ADD COLUMN response_note TEXT;
ALTER TABLE tenant_complain ADD COLUMN responded_by TEXT;
ALTER TABLE tenant_complain ADD COLUMN responded_at TEXT;

-- Daftar kerja pengelola selalu difilter status + urut tanggal lapor.
CREATE INDEX IF NOT EXISTS idx_complain_status ON tenant_complain (status, reported_at);

-- -------------------------------------------------------------------------
-- S2. Penolakan bukti bayar.
--     `verified_at`/`verified_by` sudah ada tapi hanya bisa menyatakan "sah".
--     Tanpa jalur tolak, bukti yang salah menggantung selamanya di antrean.
--     Kolom `catatan` yang lama TIDAK dipakai untuk ini — itu milik penghuni.
-- -------------------------------------------------------------------------
ALTER TABLE tr_payment_proof ADD COLUMN rejected_at TEXT;
ALTER TABLE tr_payment_proof ADD COLUMN rejected_by TEXT;
ALTER TABLE tr_payment_proof ADD COLUMN rejected_reason TEXT;

-- Antrean verifikasi = baris yang belum diverifikasi DAN belum ditolak.
CREATE INDEX IF NOT EXISTS idx_tr_proof_antrean ON tr_payment_proof (verified_at, rejected_at, created_at);

-- -------------------------------------------------------------------------
-- S4. Status pengaduan yang seragam.
--     Sebelum ini Ops menulis 'Review' sementara aplikasi penghuni hanya
--     mengenal Menunggu/Diproses/Selesai — 'Review' tampil sebagai "Menunggu"
--     di sisi penghuni, jadi progres kerja pengelola tidak pernah terlihat.
--     'Review' dinonaktifkan (bukan dihapus) supaya baris lama yang terlanjur
--     memakainya tidak kehilangan rujukan.
-- -------------------------------------------------------------------------
UPDATE settings SET aktif = 0
 WHERE grup = 'LOGBOOK_FEEDBACK' AND kolom = 'Status' AND nilai = 'Review';

INSERT OR IGNORE INTO settings (grup, kolom, nilai, urutan) VALUES
  ('LOGBOOK_FEEDBACK', 'Status', 'Menunggu',   0),
  ('LOGBOOK_FEEDBACK', 'Status', 'Diproses',   1),
  ('LOGBOOK_FEEDBACK', 'Status', 'Selesai',    2),
  ('LOGBOOK_FEEDBACK', 'Status', 'Dibatalkan', 3);

UPDATE settings SET urutan = 0, aktif = 1 WHERE grup = 'LOGBOOK_FEEDBACK' AND kolom = 'Status' AND nilai = 'Menunggu';
UPDATE settings SET urutan = 1, aktif = 1 WHERE grup = 'LOGBOOK_FEEDBACK' AND kolom = 'Status' AND nilai = 'Diproses';
UPDATE settings SET urutan = 2, aktif = 1 WHERE grup = 'LOGBOOK_FEEDBACK' AND kolom = 'Status' AND nilai = 'Selesai';
UPDATE settings SET urutan = 3, aktif = 1 WHERE grup = 'LOGBOOK_FEEDBACK' AND kolom = 'Status' AND nilai = 'Dibatalkan';

-- Baris pengaduan lama yang masih berstatus 'Review' dipindah ke kosakata baru.
UPDATE tenant_complain SET status = 'Menunggu' WHERE status = 'Review';
