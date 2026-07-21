/* =========================================================================
   Wave 0 (langkah 2) — seed tabel `settings` Turso dari db/seed/settings.json.

   TIDAK menyentuh Google Sheets sama sekali: nilai sudah dibekukan ke JSON
   (lihat catatan di file itu), sehingga seeding tidak bergantung kredensial
   service account yang aksesnya berbeda antara lokal dan produksi.

   Kunci JSON memakai format master di registry.ts:
       "setting:<GRUP>:SETTING:<Kolom>"  →  grup=<GRUP>, kolom=<Kolom>
   sehingga string master di registry.ts TIDAK perlu diubah saat Wave 1.

   DRY-RUN default. Idempoten (INSERT OR IGNORE + UPDATE urutan).

   Pakai:
       npx tsx scripts/seed-settings.ts
       npx tsx scripts/seed-settings.ts --commit
   ========================================================================= */
import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { turso } from '../src/lib/core/turso';

const commit = process.argv.includes('--commit');
const SEED_FILE = path.join(process.cwd(), 'db', 'seed', 'settings.json');

interface SeedShape {
  settings: Record<string, string[]>;
}

function parseKey(key: string): { grup: string; kolom: string } | null {
  // "setting:LOG_SALES:SETTING:Dari Mana" → grup LOG_SALES, kolom "Dari Mana"
  const parts = key.split(':');
  if (parts[0] !== 'setting' || parts.length < 4) return null;
  const grup = parts[1];
  const kolom = parts.slice(3).join(':'); // nama kolom boleh mengandung ':'
  if (!grup || !kolom) return null;
  return { grup, kolom };
}

async function main() {
  console.log(`Mode: ${commit ? 'COMMIT (menulis ke Turso)' : 'DRY-RUN (tidak menulis)'}`);
  console.log(`Sumber: ${SEED_FILE}\n`);

  const raw = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as SeedShape;
  const entries = Object.entries(raw.settings || {});
  if (entries.length === 0) throw new Error('db/seed/settings.json tidak punya isi `settings`.');

  let grupCount = 0;
  let nilaiCount = 0;
  const skipped: string[] = [];

  for (const [key, nilai] of entries) {
    const parsed = parseKey(key);
    if (!parsed) {
      skipped.push(key);
      continue;
    }
    const { grup, kolom } = parsed;
    grupCount++;
    console.log(`  ${grup} / ${kolom}: ${nilai.length} nilai`);
    nilaiCount += nilai.length;
    if (!commit) continue;

    for (let i = 0; i < nilai.length; i++) {
      const v = String(nilai[i]).trim();
      if (!v) continue;
      await turso().execute({
        sql: 'INSERT OR IGNORE INTO settings (grup, kolom, nilai, urutan) VALUES (?, ?, ?, ?)',
        args: [grup, kolom, v, i]
      });
      // pastikan urutan ikut ter-update kalau baris sudah ada dari run sebelumnya
      await turso().execute({
        sql: 'UPDATE settings SET urutan = ?, aktif = 1 WHERE grup = ? AND kolom = ? AND nilai = ?',
        args: [i, grup, kolom, v]
      });
    }
  }

  if (skipped.length) console.log(`\n  (dilewati, format kunci tak dikenal: ${skipped.join(', ')})`);
  console.log(`\nRINGKASAN: ${grupCount} dropdown, ${nilaiCount} nilai.`);

  if (commit) {
    const c = await turso().execute('SELECT COUNT(*) AS c FROM settings');
    console.log(`Total baris di tabel settings sekarang: ${c.rows[0].c}`);
  } else {
    console.log('DRY-RUN selesai. Jalankan ulang dengan --commit untuk menulis.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
