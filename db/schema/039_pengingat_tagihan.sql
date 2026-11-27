-- Pengingat jatuh tempo di Mini App.
-- Log anti-dobel pesan Telegram: satu baris per penghuni, tanggal jatuh tempo, dan tahap.
CREATE TABLE IF NOT EXISTS tagihan_pengingat_log (
  id_penghuni  TEXT NOT NULL,
  jatuh_tempo  TEXT NOT NULL,
  tahap        TEXT NOT NULL,
  dikirim_pada TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (id_penghuni, jatuh_tempo, tahap)
);

-- Rekening awal; setelah ini diubah Owner dari Pengaturan > Rekening Pembayaran.
INSERT OR IGNORE INTO app_config (key, value, updated_by)
VALUES ('rekening_pembayaran', '{"bank":"BRI","nomor":"0892-0102-1802-537","atasNama":"Dwi Antari K A Roem"}', 'migrasi 039');
