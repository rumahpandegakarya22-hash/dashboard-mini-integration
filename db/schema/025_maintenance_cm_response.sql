-- Response time tiket korektif = ditindak_pada - lapor_pada (jam), dari laporan masuk sampai penindakan.
-- Format 'YYYY-MM-DD HH:MM' waktu WIB tanpa zona. Baris lama dibiarkan NULL.
ALTER TABLE maintenance_cm ADD COLUMN lapor_pada TEXT;
ALTER TABLE maintenance_cm ADD COLUMN ditindak_pada TEXT;
