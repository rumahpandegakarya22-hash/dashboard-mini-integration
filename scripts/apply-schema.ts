/* =========================================================================
   Terapkan file DDL di db/schema/ ke Turso.

   Mengikuti konvensi scripts/recompute-turso.ts: DRY-RUN default, menulis
   hanya bila diberi --commit.

   Pakai (dari root repo):
       # aman: tampilkan statement yang AKAN dijalankan, tidak menulis
       npx tsx scripts/apply-schema.ts db/schema/001_ops_sheets_to_turso.sql

       # benar-benar terapkan ke Turso
       npx tsx scripts/apply-schema.ts db/schema/001_ops_sheets_to_turso.sql --commit

   File 000_existing_snapshot.sql SENGAJA tidak boleh diterapkan (itu cuma
   dokumentasi skema produksi apa adanya) — skrip menolaknya.

   ENV (via .env.local): TURSO_DATABASE_URL, TURSO_AUTH_TOKEN.
   ========================================================================= */
import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { turso } from '../src/lib/core/turso';

const args = process.argv.slice(2);
const commit = args.includes('--commit');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('Pakai: npx tsx scripts/apply-schema.ts <file.sql> [--commit]');
  process.exit(1);
}
if (path.basename(file).startsWith('000_')) {
  console.error('File 000_* adalah snapshot dokumentasi, bukan migrasi. Dibatalkan.');
  process.exit(1);
}

/** Pecah file SQL jadi statement. Baris komentar `--` dibuang lebih dulu supaya
 *  titik-koma di dalam komentar tidak ikut memecah statement. */
function splitStatements(sql: string): string[] {
  const noComments = sql
    .split(/\r?\n/)
    .map((l) => (l.trim().startsWith('--') ? '' : l))
    .join('\n');
  return noComments
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const raw = fs.readFileSync(file!, 'utf8');
  const stmts = splitStatements(raw);

  console.log(`File   : ${file}`);
  console.log(`Mode   : ${commit ? 'COMMIT (menulis ke Turso)' : 'DRY-RUN (tidak menulis)'}`);
  console.log(`Jumlah : ${stmts.length} statement\n`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const s of stmts) {
    const label = s.replace(/\s+/g, ' ').slice(0, 88);
    if (!commit) {
      console.log(`  [dry] ${label}`);
      continue;
    }
    try {
      await turso().execute(s);
      console.log(`  [ok ] ${label}`);
      ok++;
    } catch (e: any) {
      const msg = String(e?.message || e);
      // Idempotensi: ALTER TABLE ADD COLUMN tidak punya IF NOT EXISTS di SQLite.
      if (/duplicate column name/i.test(msg)) {
        console.log(`  [skip] sudah ada — ${label}`);
        skipped++;
        continue;
      }
      console.error(`  [GAGAL] ${label}\n          ${msg}`);
      failed++;
    }
  }

  if (!commit) {
    console.log('\nDRY-RUN selesai. Jalankan ulang dengan --commit untuk menerapkan.');
    return;
  }
  console.log(`\nRINGKASAN: ${ok} sukses, ${skipped} dilewati (sudah ada), ${failed} gagal.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
