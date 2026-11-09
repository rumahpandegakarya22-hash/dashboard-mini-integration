/* Rekonsiliasi read-only per penghuni: invoice vs jurnal Terima/Pengakuan. Jurnal berformat lama (nama bebas) muncul di daftar "jurnal lain". Pakai: npx tsx scripts/rekonsiliasi-penghuni.ts */
import './_env';
import { turso } from '../src/lib/core/turso';
const rp = (n: number) => n.toLocaleString('id-ID');
async function main() {
  const db = turso();
  const inv = (await db.execute(`SELECT nama, no_kamar, grand_total g, total_sewa ts, total_listrik tl, total_denda td, diskon dk FROM invoice_sewa`)).rows;
  const dp = (await db.execute(`SELECT nama, no_kamar, grand_total g FROM invoice_dp`)).rows;
  const jr = (await db.execute(`SELECT nominal, keterangan FROM jurnal_transaksi`)).rows;
  const per = new Map<string, { inv: number; sewa: number; dp: number; kas: number; peng: number }>();
  const get = (k: string) => { if (!per.has(k)) per.set(k, { inv: 0, sewa: 0, dp: 0, kas: 0, peng: 0 }); return per.get(k)!; };
  for (const r of inv) { const x = get(`${r.nama}|${r.no_kamar}`); x.inv += Number(r.g); x.sewa += Number(r.ts) + Number(r.tl) + Number(r.td); }
  for (const r of dp) get(`${r.nama}|${r.no_kamar}`).dp += Number(r.g);
  const sisaJ: string[] = [];
  for (const j of jr) {
    const k = String(j.keterangan); const n = Number(j.nominal);
    let m = /^Terima sewa .* dimuka (.+) KTD (\S+)$/.exec(k);
    if (m) { get(`${m[1]}|${m[2]}`).kas += n; continue; }
    m = /^Pengakuan sewa bln-\d+ (?:Sewa|Listrik) (.+) \((\S+)\)$/.exec(k);
    if (m) { get(`${m[1]}|${m[2]}`).peng += n; continue; }
    sisaJ.push(`${k} ${n}`);
  }
  let tot = { inv: 0, kas: 0, sewa: 0, peng: 0 };
  for (const [k, v] of per) {
    tot.inv += v.inv; tot.kas += v.kas; tot.sewa += v.sewa; tot.peng += v.peng;
    if (v.inv !== v.kas || v.sewa !== v.peng) console.log(`${k}  invoice=${rp(v.inv)} kasJurnal=${rp(v.kas)} selisihKas=${rp(v.inv - v.kas)} | sewa+listrik+denda=${rp(v.sewa)} pengakuan=${rp(v.peng)} selisih=${rp(v.sewa - v.peng)} | DP=${rp(v.dp)}`);
  }
  console.log('TOTAL', Object.fromEntries(Object.entries(tot).map(([a, b]) => [a, rp(b)])));
  console.log('jurnal lain (bukan Terima/Pengakuan sewa):'); sisaJ.forEach((s) => console.log('  ', s));
}
main();
