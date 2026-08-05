-- Kolom tipe feedback pada tenant_complain (5 Agustus 2026, UAT #5).
--
-- Sebelumnya submit dipecah dua tabel: kategori mengandung "komplain" masuk
-- tenant_complain, Saran/Kritik masuk tabel `feedback`. Akibatnya panel review
-- pengaduan (yang membaca tenant_complain) tidak pernah menampilkan saran &
-- kritik. Sekarang semuanya masuk tenant_complain, dibedakan kolom `tipe`.
--
-- `category` TETAP kolom lama (Kebersihan, Fasilitas, dst) — bukan tipe.
ALTER TABLE tenant_complain ADD COLUMN tipe TEXT;
UPDATE tenant_complain SET tipe = 'Komplain' WHERE tipe IS NULL;
