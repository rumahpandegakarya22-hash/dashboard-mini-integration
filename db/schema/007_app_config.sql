-- app_config: global key-value config (toggle fitur, nominal, setting email)
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Seed values (INSERT OR IGNORE agar idempotent)
INSERT OR IGNORE INTO app_config (key, value) VALUES ('deposit_enabled', '0');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('deposit_nominal', '0');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('laporan_email_to', '');
