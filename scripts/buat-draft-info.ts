/* =========================================================================
   Membuat src/lib/draft-info/templates.json dari ekspor HTML Google Docs
   "Kumpulan Template Pesan Admin" (File → Download → Web Page (.html, zipped) → ambil .html-nya).

   Pakai:  npx tsx scripts/buat-draft-info.ts <path-ke-file.html>
   ========================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { parseTemplateHtml } from '../src/lib/draft-info/parse-html';

const sumber = process.argv[2];
if (!sumber) {
  console.error('Pakai: npx tsx scripts/buat-draft-info.ts <path-ke-file.html>');
  process.exit(1);
}
const daftar = parseTemplateHtml(fs.readFileSync(sumber, 'utf8'));
if (!daftar.length) throw new Error('Tidak ada template terbaca. Pastikan file adalah ekspor HTML dokumen template.');

const tujuan = path.join(process.cwd(), 'src/lib/draft-info/templates.json');
fs.writeFileSync(tujuan, JSON.stringify(daftar, null, 2) + '\n');
const placeholder = (s: string) => [...new Set([...s.matchAll(/\{\{([^}]+)\}\}/g)].map((x) => x[1]))];
for (const t of daftar) console.log(`${t.no.padStart(3)}  ${t.judul}  [${placeholder(t.isi).join(' | ')}]`);
console.log(`\n${daftar.length} template ditulis ke ${tujuan}`);
