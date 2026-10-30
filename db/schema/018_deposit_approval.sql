-- Pengembalian deposit diputuskan di layar Approval Check-out (bukan lagi diketik di modul Checkout).
-- Nominal deposit asli tetap dibaca dari booking.deposit; dua kolom ini hanya menyimpan keputusan approval.
ALTER TABLE kondisi_kamar ADD COLUMN deposit_dikembalikan INTEGER;
ALTER TABLE kondisi_kamar ADD COLUMN catatan_deposit TEXT;
