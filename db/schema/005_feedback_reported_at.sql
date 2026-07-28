-- =========================================================================
-- S3 — kolom tanggal di tabel `feedback`.
--
-- Aplikasi penghuni Teman Rara kini bisa mengirim Saran dan Kritik, bukan
-- hanya Komplain. Komplain masuk `tenant_complain` (punya `reported_at`),
-- Saran/Kritik masuk `feedback` — dan tabel itu TIDAK punya kolom tanggal
-- sama sekali. Tanpa ini, daftar milik penghuni tidak bisa diurutkan dan
-- analisis "saran apa yang muncul di periode mana" mustahil dilakukan.
--
-- Selama ini tanggal diselipkan ke dalam teks `deskripsi` dengan format
-- "[YYYY-MM-DD] [Jenis] isi" oleh handler Ops, lalu di-parse balik dengan
-- regex saat diedit. Kolom ini menggantikan trik tersebut untuk baris baru;
-- format teks lama TETAP ditulis agar fitur edit Ops yang sudah ada tidak
-- rusak. Backfill di bawah mengangkat tanggal dari baris-baris lama.
--
-- Rollback: ALTER TABLE feedback DROP COLUMN reported_at;
-- =========================================================================

ALTER TABLE feedback ADD COLUMN reported_at TEXT;

-- Backfill dari pola "[YYYY-MM-DD] ..." di awal deskripsi. Baris yang tidak
-- mengikuti pola dibiarkan NULL — menebak tanggalnya lebih buruk daripada
-- mengakui tidak tahu.
UPDATE feedback
   SET reported_at = substr(deskripsi, 2, 10)
 WHERE reported_at IS NULL
   AND deskripsi LIKE '[____-__-__]%';

CREATE INDEX IF NOT EXISTS idx_feedback_penghuni ON feedback (id_penghuni, reported_at);
