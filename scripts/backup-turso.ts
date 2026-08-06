/* =========================================================================
   Backup penuh database Turso ke file .sql yang bisa di-restore.

   Dump schema (CREATE TABLE/INDEX/TRIGGER/VIEW) + seluruh baris data sebagai
   INSERT, dibungkus satu transaksi. Aman dijalankan berulang — tiap run
   menulis file baru bertimestamp, tidak menyentuh data di Turso (read-only).

   Pakai (dari root repo):
       npx tsx scripts/backup-turso.ts            # backup kedua database
       npx tsx scripts/backup-turso.ts main       # hanya kost-tiga-dara
       npx tsx scripts/backup-turso.ts inventory  # hanya inventory stock

   Output: backups/<db>-YYYYMMDD-HHmmss.sql  (folder di-gitignore, berisi PII).

   ENV (via .env.local):
       TURSO_DATABASE_URL / TURSO_AUTH_TOKEN           -> "main"
       INVENTORY_DATABASE_URL / INVENTORY_AUTH_TOKEN   -> "inventory"
   ========================================================================= */
import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';

type Target = { key: string; url?: string; token?: string };

const TARGETS: Target[] = [
  { key: 'kost-tiga-dara', url: process.env.TURSO_DATABASE_URL, token: process.env.TURSO_AUTH_TOKEN },
  { key: 'inventorystockktd', url: process.env.INVENTORY_DATABASE_URL, token: process.env.INVENTORY_AUTH_TOKEN },
];

/** Filter opsional dari argumen CLI: "main" -> kost-tiga-dara, "inventory" -> inventorystockktd. */
function pickTargets(): Target[] {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!arg) return TARGETS;
  if (/^main|kost/i.test(arg)) return [TARGETS[0]];
  if (/^inv/i.test(arg)) return [TARGETS[1]];
  console.error(`Argumen tak dikenal: "${arg}". Pakai: (kosong) | main | inventory`);
  process.exit(1);
}

/** SQLite literal untuk satu nilai kolom. Blob -> X'..hex..'. */
function lit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
    const bytes = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array((v as ArrayBufferView).buffer);
    let hex = '';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return `X'${hex}'`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Stempel waktu lokal YYYYMMDD-HHmmss tanpa pemisah rewel. */
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function dump(client: Client, key: string, outDir: string): Promise<string> {
  // Objek schema, urut supaya table dulu baru index/trigger/view.
  const schema = await client.execute(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
     ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name`,
  );

  const tables = schema.rows.filter((r) => r.type === 'table').map((r) => String(r.name));

  const out: string[] = [];
  out.push(`-- Backup Turso: ${key}`);
  out.push(`-- Dibuat: ${new Date().toISOString()}`);
  out.push(`-- Tabel: ${tables.length}`);
  out.push('PRAGMA foreign_keys=OFF;');
  out.push('BEGIN TRANSACTION;');

  // 1) Schema (tabel dulu).
  for (const r of schema.rows) {
    if (r.type === 'table') out.push(`${String(r.sql).trim()};`);
  }

  // 2) Data per tabel.
  let totalRows = 0;
  for (const t of tables) {
    const res = await client.execute(`SELECT * FROM "${t}"`);
    if (res.rows.length === 0) continue;
    const cols = res.columns.map((c) => `"${c}"`).join(', ');
    out.push(`\n-- data: ${t} (${res.rows.length} baris)`);
    for (const row of res.rows) {
      const vals = res.columns.map((c) => lit((row as Record<string, unknown>)[c])).join(', ');
      out.push(`INSERT INTO "${t}" (${cols}) VALUES (${vals});`);
    }
    totalRows += res.rows.length;
  }

  // 3) Index/trigger/view setelah data.
  out.push('');
  for (const r of schema.rows) {
    if (r.type !== 'table') out.push(`${String(r.sql).trim()};`);
  }

  out.push('COMMIT;');
  out.push('PRAGMA foreign_keys=ON;');
  out.push('');

  const file = path.join(outDir, `${key}-${stamp()}.sql`);
  fs.writeFileSync(file, out.join('\n'), 'utf8');
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`  [ok] ${key}: ${tables.length} tabel, ${totalRows} baris -> ${path.relative(process.cwd(), file)} (${kb} KB)`);
  return file;
}

async function main() {
  const targets = pickTargets();
  const outDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(outDir, { recursive: true });

  let failed = 0;
  for (const t of targets) {
    if (!t.url || !t.token) {
      console.error(`  [SKIP] ${t.key}: URL/token tidak ada di .env.local`);
      failed++;
      continue;
    }
    const client = createClient({ url: t.url, authToken: t.token });
    try {
      await dump(client, t.key, outDir);
    } catch (e: any) {
      console.error(`  [GAGAL] ${t.key}: ${String(e?.message || e)}`);
      failed++;
    } finally {
      client.close();
    }
  }

  console.log(failed ? `\nSelesai dengan ${failed} masalah.` : '\nSelesai. Semua database ter-backup.');
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
