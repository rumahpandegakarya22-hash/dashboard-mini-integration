-- Tambahan listrik dipindah dari kamar ke penghuni (5 Agustus 2026).
--
-- Alasan: biaya listrik tambahan timbul dari barang elektronik milik PENGHUNI
-- (kulkas, rice cooker, dsb), bukan sifat kamarnya. Menyimpannya di `kamar`
-- membuat tagihan penghuni berikutnya ikut terbawa walau ia tidak membawa
-- barang apa pun, dan riwayat tagihan penghuni lama jadi tidak bisa ditelusuri.
--
-- kamar.listrik SENGAJA TIDAK di-drop di sini: masih jadi rujukan nilai lama
-- kalau backfill di bawah perlu diperiksa ulang. Sudah tidak dibaca kode.
ALTER TABLE active_tenant ADD COLUMN tambahan_listrik INTEGER;
ALTER TABLE occupancy_history ADD COLUMN tambahan_listrik INTEGER;
