/* Rekonsiliasi read-only: invoice vs jurnal, dan saldo yang tidak masuk akal.
   Pakai: npx tsx scripts/rekonsiliasi-keuangan.ts
   Tidak menulis apa pun ke database. */
import './_env';
import { turso } from '../src/lib/core/turso';
import { fmtTanggal, fmtTeks } from '../src/lib/format-tanggal';

const rp = (n: number) => n.toLocaleString('id-ID');

async function main() {
  const db = turso();
  const rows = async (sql: string) => (await db.execute(sql)).rows;

  const sewa = await rows(`SELECT no_inv, nama, no_kamar, tanggal_pembayaran t, grand_total g FROM invoice_sewa`);
  const dp = await rows(`SELECT no_inv, nama, no_kamar, tanggal_pembayaran t, grand_total g FROM invoice_dp`);
  const terima = await rows(`SELECT keterangan k, tanggal t, nominal n FROM jurnal_transaksi WHERE keterangan LIKE 'Terima %'`);

  const cocok = (jenis: string, nama: string, kamar: string) =>
    terima.some((j) => String(j.k).startsWith(jenis) && String(j.k).includes(`${nama} KTD ${kamar}`));

  const tanpaJurnal = [
    ...sewa.filter((r) => !cocok('Terima sewa', String(r.nama), String(r.no_kamar))).map((r) => ({ jenis: 'Sewa', t: r.t, no_inv: r.no_inv, nama: r.nama, no_kamar: r.no_kamar, g: r.g })),
    ...dp.filter((r) => !cocok('Terima DP', String(r.nama), String(r.no_kamar))).map((r) => ({ jenis: 'DP', t: r.t, no_inv: r.no_inv, nama: r.nama, no_kamar: r.no_kamar, g: r.g }))
  ];
  console.log(`Invoice tanpa jurnal penerimaan: ${tanpaJurnal.length}, total Rp${rp(tanpaJurnal.reduce((s, r) => s + Number(r.g), 0))}`);
  for (const r of tanpaJurnal) console.log(`  ${r.jenis}  ${fmtTanggal(r.t)}  ${r.no_inv}  ${r.nama} (${r.no_kamar})  Rp${rp(Number(r.g))}`);

  console.log(`\nTotal invoice sewa Rp${rp(sewa.reduce((s, r) => s + Number(r.g), 0))}, DP Rp${rp(dp.reduce((s, r) => s + Number(r.g), 0))}`);
  console.log(`Total jurnal 'Terima' Rp${rp(terima.reduce((s, r) => s + Number(r.n), 0))}`);

  const [s2105] = await rows(`SELECT COALESCE(SUM(CASE WHEN akun_kredit_kode=2105 THEN nominal ELSE -nominal END),0) s FROM jurnal_transaksi WHERE akun_debit_kode=2105 OR akun_kredit_kode=2105`);
  console.log(`\nSaldo 2105 (semua tanggal): Rp${rp(Number(s2105.s))} ${Number(s2105.s) < 0 ? '<-- NEGATIF: pendapatan diakui melebihi uang masuk' : ''}`);

  const bulan = await rows(`SELECT substr(tanggal,1,7) b, SUM(nominal) n FROM jurnal_transaksi WHERE akun_kredit_kode=4101 GROUP BY 1 ORDER BY 1`);
  console.log('\nPendapatan sewa diakui per bulan:');
  for (const b of bulan) console.log(`  ${b.b}  Rp${rp(Number(b.n))}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
