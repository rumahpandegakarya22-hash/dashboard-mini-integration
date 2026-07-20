/* =========================================================================
   Cek cakupan kelas CSS Dashboard (Fase 4 langkah 6).

   Mengumpulkan setiap `className` yang dipakai komponen dashboard, lalu
   memastikan kelas itu benar-benar ada di `theme-dashboard.css`.

   Alasan ada uji ini: dua kali selama Fase 4 saya sempat mengarang nama kelas
   yang tidak ada di CSS (`.toolbar`/`.tbl-search`, lalu `.sidebar-hidden`).
   Kesalahan itu TIDAK tertangkap typecheck maupun build — hasilnya hanya elemen
   tampil tanpa gaya. Uji ini menutup celah tersebut.

   Pakai: npx tsx scripts/css-coverage-check.ts
   ========================================================================= */
import fs from 'node:fs';
import path from 'node:path';

const CSS = fs.readFileSync('src/styles/theme-dashboard.css', 'utf8');

const ROOTS = ['src/components/dashboard', 'src/components/ui', 'src/components/charts'];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r));

const used = new Map<string, Set<string>>(); // kelas -> berkas pemakai
const add = (cls: string, file: string) => {
  if (!/^[a-z][a-z0-9_-]*$/i.test(cls)) return;
  if (!used.has(cls)) used.set(cls, new Set());
  used.get(cls)!.add(file);
};

for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  // className="a b c"
  for (const m of t.matchAll(/className="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => add(c, f));
  // className={`a ${x ? 'b' : ''}`} — ambil literal di dalam template & string
  for (const m of t.matchAll(/className=\{`([^`]*)`\}/g)) {
    for (const lit of m[1].split(/\$\{[^}]*\}/)) lit.split(/\s+/).forEach((c) => add(c, f));
    for (const s of m[1].matchAll(/'([a-z][a-z0-9 _-]*)'/gi)) s[1].split(/\s+/).forEach((c) => add(c, f));
  }
  // className={'a'} atau className={cond ? 'a' : 'b'}
  for (const m of t.matchAll(/className=\{[^}]*?'([a-z][a-z0-9 _-]*)'/gi))
    m[1].split(/\s+/).forEach((c) => add(c, f));
}

/** Kelas dianggap ada bila muncul sebagai selector di CSS. */
const inCss = (cls: string): boolean => {
  const esc = cls.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  return new RegExp('\\.' + esc + '(?![\\w-])').test(CSS);
};

const missing = [...used.keys()].filter((c) => !inCss(c)).sort();

console.log(`\nKelas dipakai komponen : ${used.size}`);
console.log(`Ada di theme-dashboard : ${used.size - missing.length}`);

if (missing.length) {
  console.log(`\nTIDAK ditemukan di CSS (${missing.length}):`);
  for (const c of missing) {
    console.log(`  .${c}  <- ${[...used.get(c)!].map((f) => f.replace(/\\/g, '/')).join(', ')}`);
  }
  console.log('\nCatatan: kelas milik theme-ops.css (mis. komponen dipakai bersama) wajar muncul di sini.');
} else {
  console.log('\n✅ Semua kelas yang dipakai ada di theme-dashboard.css.');
}
process.exit(0);
