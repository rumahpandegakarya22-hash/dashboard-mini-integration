/* =========================================================================
   Kost Tiga Dara — Dump Formula Spreadsheet (untuk mengunci formula ambigu)

   PORT dari `server/dump-formulas.js` repo Dashboard lama (Fase 2).

   Beberapa formula tidak bisa dipastikan 100% dari data hasil migrasi saja
   (ROI promosi, ambang SLA maintenance, kategori jurnal — semua bertanda
   [PENDING] di src/lib/dashboard/compute.ts). Script ini membaca spreadsheet
   sumber dengan valueRenderOption=FORMULA sehingga RUMUS ASLINYA ikut
   ter-ekspor, bukan hanya hasilnya.

   Output: docs/formulas-dump.json berisi, per tab:
     • headers      : baris header asli (untuk menyamakan label di sheet-map.ts)
     • formulaByCol : contoh rumus per kolom (dari baris data pertama yg berisi rumus)
     • rawFormulas  : 6 baris pertama (rumus mentah) untuk inspeksi manual

   Cara pakai:
       npx tsx scripts/dump-formulas.ts [spreadsheetId]

   PENYIMPANGAN PORT (dicatat di docs/MIGRASI.md):
   - Autentikasi memakai `lib/core/google.ts` (GOOGLE_SERVICE_ACCOUNT_EMAIL +
     GOOGLE_PRIVATE_KEY) alih-alih jalur lama `data/service-account.json` /
     GOOGLE_SERVICE_ACCOUNT_JSON, yang env-nya dibuang saat deduplikasi Fase 0.
     Tanpa adaptasi ini skrip tidak akan bisa jalan sama sekali.
   - Output pindah ke docs/ (repo terpadu tidak punya data/).
   ========================================================================= */
import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { sheetsClient } from '../src/lib/core/google';

const DEFAULT_SPREADSHEET_ID = '1-xXweqO9IO6s0EQqF0fc7EKSybvn5CUSD601-Dvj328';

interface TabDump {
  headers: any[];
  formulaByCol: Record<string, string>;
  rawFormulas: any[][];
}

async function main() {
  const spreadsheetId =
    process.argv[2] ||
    process.env.SHEETS_SPREADSHEET_ID ||
    process.env.SPREADSHEET_ID ||
    DEFAULT_SPREADSHEET_ID;

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error(
      '✗ GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY belum di-set di .env.local. Batal.'
    );
    process.exit(1);
  }

  const sheetsApi = sheetsClient();

  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title'
  });
  const titles = (meta.data.sheets || []).map((s: any) => s.properties.title as string);
  console.log(`Membaca ${titles.length} tab: ${titles.join(', ')}`);

  const resp = await sheetsApi.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: titles,
    valueRenderOption: 'FORMULA'
  });

  const dump: Record<string, TabDump> = {};
  (resp.data.valueRanges || []).forEach((vr: any, i: number) => {
    const rows: any[][] = vr.values || [];
    const headers: any[] = rows[0] || [];
    const formulaByCol: Record<string, string> = {};
    headers.forEach((h, ci) => {
      // cari sel pertama (di bawah header) yang berupa rumus (diawali '=')
      for (let ri = 1; ri < rows.length; ri++) {
        const cell = rows[ri] && rows[ri][ci];
        if (typeof cell === 'string' && cell.startsWith('=')) {
          formulaByCol[h || `col${ci}`] = cell;
          break;
        }
      }
    });
    dump[titles[i]] = { headers, formulaByCol, rawFormulas: rows.slice(0, 6) };
  });

  const outDir = path.join(process.cwd(), 'docs');
  const outPath = path.join(outDir, 'formulas-dump.json');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`✓ Tersimpan: ${outPath}`);
  console.log('  Pakai tab PROMOSI & MAINTENANCE untuk mengunci formula ROI/SLA di compute.ts.');
}

main().catch((e) => {
  console.error('✗ Error:', e.message);
  process.exit(1);
});
