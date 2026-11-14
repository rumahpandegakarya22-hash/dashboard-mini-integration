-- Respons leads pertama = chat_pertama_pada - masuk_pada (menit).
-- Format 'YYYY-MM-DD HH:MM' waktu WIB tanpa zona (sama dengan kolom tanggal lain).
-- Baris lama dibiarkan NULL (tidak ditebak).
ALTER TABLE leads ADD COLUMN masuk_pada TEXT;
ALTER TABLE leads ADD COLUMN chat_pertama_pada TEXT;
