/* =========================================================================
   Cek integritas laporan keuangan: jalankan mesin laporan (dari Turso) untuk
   satu periode lalu pastikan Neraca seimbang (Total Aset = Total Pasiva).

   Pakai (dari root repo):
       npx tsx scripts/laporan-check.ts 2026-06     # cek periode tertentu
       npx tsx scripts/laporan-check.ts             # default bulan ini

   Semua angka murni dari tabel jurnal_transaksi + coa di Turso — TIDAK ada
   data dari spreadsheet.
   ========================================================================= */
import './_env';
import { buildLabaRugi, buildArusKas, buildNeraca } from '../src/lib/laporan/generator';

const rp = (n: number | null) =>
  n == null ? '' : (n < 0 ? `(${Math.abs(n).toLocaleString('id-ID')})` : n.toLocaleString('id-ID'));

async function main() {
  const arg = process.argv.find((a) => /^\d{4}-\d{2}$/.test(a));
  const periode = arg ?? new Date().toISOString().slice(0, 7);
  const [y, m] = periode.split('-').map(Number);
  const dari = `${periode}-01`;
  const sampai = new Date(y, m, 0).toISOString().slice(0, 10);

  const lr = await buildLabaRugi(dari, sampai);
  const ak = await buildArusKas(dari, sampai);
  const nr = await buildNeraca(sampai);

  console.log(`\n=== LABA RUGI ${periode} ===`);
  for (const b of lr.baris) console.log((b.seksi ? '' : '  ') + b.label.padEnd(38), rp(b.nilai));
  console.log(`\n=== ARUS KAS ${periode} ===`);
  for (const b of ak.baris) console.log((b.seksi ? '' : '  ') + b.label.padEnd(38), rp(b.nilai));
  console.log(`\n=== NERACA per ${periode} ===`);
  for (const b of nr.sisi.kiri) console.log('A ' + (b.seksi ? '' : '  ') + b.label.padEnd(34), rp(b.nilai));
  for (const b of nr.sisi.kanan) console.log('P ' + (b.seksi ? '' : '  ') + b.label.padEnd(34), rp(b.nilai));

  const ta = Number(nr.sisi.kiri.find((b) => b.label === 'TOTAL ASET')?.nilai ?? 0);
  const tp = Number(nr.sisi.kanan.find((b) => b.label === 'TOTAL PASIVA')?.nilai ?? 0);
  const selisih = ta - tp;
  console.log(`\nCEK NERACA: Aset ${rp(ta)} vs Pasiva ${rp(tp)} → selisih ${rp(selisih)}`);
  if (Math.abs(selisih) >= 1) {
    console.error('GAGAL: Neraca tidak seimbang.');
    process.exit(1);
  }
  console.log('OK: Neraca seimbang.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
