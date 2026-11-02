/* =========================================================================
   Cek laporan bulanan (HANYA BACA): render HTML tiap laporan dari Turso,
   cetak teksnya dan cari cacat (NaN, undefined, [object, Infinity, null).
   Tidak membuat PDF, tidak upload ke Drive, tidak menulis ke database.

   Pakai (dari root repo):
       npx tsx scripts/laporan-bulanan-check.ts <id|semua> <YYYY-MM> [--html <dir>] [--full]
   Exit code 1 bila ada laporan gagal render atau bercacat.
   ========================================================================= */
import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { LAPORAN, cariLaporan } from '../src/lib/laporan-bulanan/registry';
import { parsePeriode } from '../src/lib/laporan-bulanan/periode';
import { teksPolos, cariCacat } from '../src/lib/laporan-bulanan/cek';

const BATAS = 1500;

async function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const iHtml = args.indexOf('--html');
  const dirHtml = iHtml >= 0 ? args[iHtml + 1] : undefined;
  const posisi = args.filter((a, i) => !a.startsWith('--') && i !== iHtml + 1);
  const [id, kode] = posisi;
  if (!id || !kode || (iHtml >= 0 && !dirHtml)) {
    console.error('Pakai: npx tsx scripts/laporan-bulanan-check.ts <id|semua> <YYYY-MM> [--html <dir>] [--full]');
    process.exit(2);
  }

  const daftar = id === 'semua' ? LAPORAN : [cariLaporan(id)].filter((d) => d !== undefined);
  if (daftar.length === 0) {
    console.error(`Laporan "${id}" tidak ditemukan. Id: ${LAPORAN.map((d) => d.id).join(', ')}`);
    process.exit(2);
  }
  const periode = parsePeriode(kode);
  if (dirHtml) fs.mkdirSync(dirHtml, { recursive: true });

  let bermasalah = 0;
  for (const def of daftar) {
    console.log(`\n=== ${def.id} (${def.judul}) ${periode.kode} ===`);
    try {
      const html = await def.render(periode, new Date());
      const teks = teksPolos(html);
      const cacat = cariCacat(html);
      if (dirHtml) fs.writeFileSync(path.join(dirHtml, `${def.id}.html`), html, 'utf8');
      console.log(`${teks.length} karakter`);
      console.log(full || teks.length <= BATAS ? teks : `${teks.slice(0, BATAS)} ... [dipotong, pakai --full]`);
      if (cacat.length) {
        bermasalah++;
        console.log(`CACAT: ${cacat.join(', ')}`);
      } else console.log('OK');
    } catch (e) {
      bermasalah++;
      console.log(`CACAT: gagal render - ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\nRINGKASAN: ${daftar.length - bermasalah}/${daftar.length} OK, ${bermasalah} bermasalah.`);
  process.exit(bermasalah ? 1 : 0);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
