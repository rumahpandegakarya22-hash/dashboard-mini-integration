/* =========================================================================
   Golden test Fase 2 (§11.3) — paritas data layer lama vs baru.

   Membandingkan keluaran port TypeScript terhadap snapshot keluaran Dashboard
   Express lama, dijalankan terhadap DATABASE TURSO YANG SAMA dengan kredensial
   yang sama, sehingga selisih apa pun murni berasal dari kode.

   Yang dibandingkan:
     1. readComputedTables()  → docs/golden-old.json         (R1: paritas formula)
     2. readComputedSheets()  → docs/golden-old-sheets.json  (R1: bentuk tab)
     3. filterTablesForRole / filterSheetsForRole untuk 5 role
                              → docs/golden-old-rls.json     (R2: RLS + redaksi PII)

   Pakai:  npx tsx scripts/golden-check.ts
   Exit 1 bila ada selisih.
   ========================================================================= */

import fs from 'node:fs';
import path from 'node:path';

// --- env sebelum modul apa pun menyentuh process.env ---
const envPath = path.join(process.cwd(), '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const DOCS = path.join(process.cwd(), 'docs');
const ROLES = ['owner', 'admin', 'marketing', 'operasional', 'sales'];

/** Diff struktural. Mengembalikan daftar path yang berbeda (dibatasi). */
function diff(a: any, b: any, at = '', out: string[] = [], limit = 40): string[] {
  if (out.length >= limit) return out;
  if (a === b) return out;

  const ta = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a;
  const tb = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;
  if (ta !== tb) {
    out.push(`${at}: tipe beda (lama=${ta}, baru=${tb})`);
    return out;
  }
  if (ta === 'array') {
    if (a.length !== b.length) out.push(`${at}: panjang beda (lama=${a.length}, baru=${b.length})`);
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n && out.length < limit; i++) diff(a[i], b[i], `${at}[${i}]`, out, limit);
    return out;
  }
  if (ta === 'object') {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    for (const k of ka) if (!(k in b) && out.length < limit) out.push(`${at}.${k}: hilang di baru`);
    for (const k of kb) if (!(k in a) && out.length < limit) out.push(`${at}.${k}: tambahan di baru`);
    for (const k of ka) if (k in b && out.length < limit) diff(a[k], b[k], `${at}.${k}`, out, limit);
    return out;
  }
  out.push(`${at}: nilai beda (lama=${JSON.stringify(a)}, baru=${JSON.stringify(b)})`);
  return out;
}

function report(label: string, oldObj: any, newObj: any): boolean {
  const d = diff(oldObj, newObj);
  if (!d.length) {
    console.log(`  ✅ ${label}: IDENTIK`);
    return true;
  }
  console.log(`  ❌ ${label}: ${d.length} selisih (maks 40 ditampilkan)`);
  for (const line of d) console.log(`       ${line}`);
  return false;
}

(async () => {
  const { readComputedTables, readComputedSheets } = await import('../src/lib/dashboard/source');
  const { filterTablesForRole, filterSheetsForRole } = await import('../src/lib/dashboard/rls');

  const tables = await readComputedTables();
  const sheets = await readComputedSheets();

  const rlsTables: Record<string, unknown> = {};
  const rlsSheets: Record<string, unknown> = {};
  for (const r of ROLES) {
    rlsTables[r] = filterTablesForRole(tables, r);
    rlsSheets[r] = filterSheetsForRole(sheets, r);
  }
  const rls = { tables: rlsTables, sheets: rlsSheets };

  fs.writeFileSync(path.join(DOCS, 'golden-new.json'), JSON.stringify(tables, null, 1));
  fs.writeFileSync(path.join(DOCS, 'golden-new-sheets.json'), JSON.stringify(sheets, null, 1));
  fs.writeFileSync(path.join(DOCS, 'golden-new-rls.json'), JSON.stringify(rls, null, 1));

  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DOCS, f), 'utf8'));

  console.log('\nGolden test Fase 2 — lama vs baru (Turso & kredensial identik)\n');
  // Round-trip lewat JSON agar perbandingan setara: snapshot lama pun tersimpan sbg JSON.
  const ok = [
    report('R1 tables (paritas formula)', read('golden-old.json'), JSON.parse(JSON.stringify(tables))),
    report('R1 sheets (bentuk tab)', read('golden-old-sheets.json'), JSON.parse(JSON.stringify(sheets))),
    report('R2 RLS + redaksi PII (5 role)', read('golden-old-rls.json'), JSON.parse(JSON.stringify(rls)))
  ].every(Boolean);

  console.log('\nRingkasan:');
  for (const [t, rows] of Object.entries(tables)) {
    console.log(`  ${t.padEnd(20)} ${(rows as unknown[]).length} baris`);
  }
  console.log(`  tab sheets: ${Object.keys(sheets).length}`);

  console.log(ok ? '\n✅ GOLDEN TEST LULUS — diff kosong.\n' : '\n❌ GOLDEN TEST GAGAL — ada selisih.\n');
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('GAGAL:', e);
  process.exit(1);
});
