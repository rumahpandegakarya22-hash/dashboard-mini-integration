/* Muat .env.local ke process.env untuk skrip CLI (dijalankan via tsx, di luar
   bundle Next sehingga tidak dapat pemuatan env otomatis dari Next).
   Impor modul ini PALING ATAS, sebelum modul apa pun menyentuh process.env. */
import fs from 'node:fs';
import path from 'node:path';

const p = path.join(process.cwd(), '.env.local');
if (fs.existsSync(p)) {
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
