/* =========================================================================
   Uji kontrak API Fase 3 (§9 Fase 3.4) — respons endpoint baru vs Express lama.

   Membandingkan BENTUK & ISI JSON untuk kelima role Dashboard.

   Cara kerja: menyusun envelope respons persis seperti Route Handler baru
   (`/api/dashboard/db`, `/api/dashboard/sheets`) dari fungsi lib yang sama,
   lalu membandingkannya dengan envelope yang DULU dihasilkan server.js Express
   di atas snapshot RLS lama (docs/golden-old-rls.json, dibuat Fase 2 dari kode
   lama yang benar-benar dijalankan).

   Yang TIDAK bisa diuji di sini: jalur ber-sesi Clerk nyata (butuh login).
   Itu diuji terpisah lewat HTTP di scripts/contract-http.sh + UAT §11.4.

   Pakai:  npx tsx scripts/contract-check.ts
   ========================================================================= */
import './_env';
import fs from 'node:fs';
import path from 'node:path';

const DOCS = path.join(process.cwd(), 'docs');
const ROLES = ['owner', 'admin', 'marketing', 'operasional', 'sales'];

function diff(a: any, b: any, at = '', out: string[] = [], limit = 25): string[] {
  if (out.length >= limit || a === b) return out;
  const ta = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a;
  const tb = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;
  if (ta !== tb) {
    out.push(`${at}: tipe beda (lama=${ta}, baru=${tb})`);
    return out;
  }
  if (ta === 'array') {
    if (a.length !== b.length) out.push(`${at}: panjang beda (${a.length} vs ${b.length})`);
    for (let i = 0; i < Math.min(a.length, b.length) && out.length < limit; i++)
      diff(a[i], b[i], `${at}[${i}]`, out, limit);
    return out;
  }
  if (ta === 'object') {
    for (const k of Object.keys(a)) if (!(k in b) && out.length < limit) out.push(`${at}.${k}: hilang di baru`);
    for (const k of Object.keys(b)) if (!(k in a) && out.length < limit) out.push(`${at}.${k}: tambahan di baru`);
    for (const k of Object.keys(a)) if (k in b && out.length < limit) diff(a[k], b[k], `${at}.${k}`, out, limit);
    return out;
  }
  out.push(`${at}: nilai beda (lama=${JSON.stringify(a)}, baru=${JSON.stringify(b)})`);
  return out;
}

(async () => {
  const { readComputedTables, readComputedSheets } = await import('../src/lib/dashboard/source');
  const { filterTablesForRole, filterSheetsForRole } = await import('../src/lib/dashboard/rls');

  const oldRls = JSON.parse(fs.readFileSync(path.join(DOCS, 'golden-old-rls.json'), 'utf8'));
  const tables = await readComputedTables();
  const sheets = await readComputedSheets();

  let fail = 0;
  console.log('\nUji kontrak Fase 3 — envelope respons lama vs baru, per role\n');

  for (const role of ROLES) {
    // Envelope PERSIS seperti server.js lama:
    //   /api/db     → { configured: true, tables: filterTablesForRole(...) }
    //   /api/sheets → { configured: true, source: 'turso', sheets: filterSheetsForRole(...) }
    const oldDb = { configured: true, tables: oldRls.tables[role] };
    const oldSheets = { configured: true, source: 'turso', sheets: oldRls.sheets[role] };

    const newDb = JSON.parse(JSON.stringify({ configured: true, tables: filterTablesForRole(tables, role) }));
    const newSheets = JSON.parse(
      JSON.stringify({ configured: true, source: 'turso', sheets: filterSheetsForRole(sheets, role) })
    );

    for (const [label, o, n] of [
      [`/api/dashboard/db     [${role}]`, oldDb, newDb],
      [`/api/dashboard/sheets [${role}]`, oldSheets, newSheets]
    ] as [string, any, any][]) {
      const d = diff(o, n);
      if (d.length) {
        fail++;
        console.log(`  ❌ ${label}: ${d.length} selisih`);
        for (const line of d.slice(0, 6)) console.log(`       ${line}`);
      } else {
        const tabs = Object.keys(n.tables || n.sheets).length;
        console.log(`  ✅ ${label}: IDENTIK  (${tabs} ${n.tables ? 'tabel' : 'tab'} lolos RLS)`);
      }
    }
  }

  console.log(fail === 0 ? '\n✅ UJI KONTRAK LULUS — semua envelope identik.\n' : `\n❌ ${fail} kontrak berbeda.\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('GAGAL:', e);
  process.exit(1);
});
