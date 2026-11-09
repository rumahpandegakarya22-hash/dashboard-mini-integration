/* Perbaiki jurnal sewa yang tidak cocok dengan invoice.
   1. Hapus baris jurnal duplikat persis (sisakan id terkecil) dan invoice_sewa ganda (isi sama, tanpa payment).
   2. Invoice yang jurnalnya berformat lama (nama pendek, listrik terpisah): ganti dengan format baru bila angkanya cocok.
   3. Invoice yang sudah dibayar tapi tidak punya jurnal sama sekali: buat jurnal baru (kas default 1103, akun yang dipakai seluruh jurnal Terima).
   Sisanya hanya dilaporkan. DRY-RUN default. Pakai: npx tsx scripts/perbaiki-jurnal-sewa.ts [--commit] */
import './_env';
import { turso } from '../src/lib/core/turso';
import { barisJurnalSewa, type BarisJurnal } from '../src/lib/jurnal';

const commit = process.argv.includes('--commit');
const int = (v: unknown) => Math.round(Number(v ?? 0)) || 0;
const rp = (n: number) => n.toLocaleString('id-ID');
const INS = 'INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori) VALUES (?,?,?,?,?,?)';

type J = { id: number; tanggal: string; debit: number; kredit: number; nominal: number; ket: string };
const norm = (s: string) => s.toLowerCase().replace(/\s*\(\d+\)\s*$/, '').trim();
const lamaRe = /^(Terima sewa (\d+) bln dimuka|Pengakuan sewa bln-(\d+)) (?:(Sewa|Listrik|Listrk Kamar) )?(.+)$/;

async function main() {
  const db = turso();
  const stmts: { sql: string; args: any[] }[] = [];
  const out = (s: string) => console.log(s);
  const tulis = (baris: BarisJurnal[]) => baris.forEach((b) => stmts.push({ sql: INS, args: [b.tanggal, b.debit, b.kredit, b.nominal, b.keterangan, b.kategori] }));

  // 1a. jurnal duplikat persis
  const jur = (await db.execute('SELECT id, tanggal, akun_debit_kode d, akun_kredit_kode k, nominal n, keterangan ket, kategori FROM jurnal_transaksi ORDER BY id')).rows as any[];
  const lihat = new Set<string>();
  const hapusId = new Set<number>();
  for (const r of jur) {
    const key = [r.tanggal, r.d, r.k, r.n, r.ket, r.kategori].join('|');
    if (lihat.has(key)) hapusId.add(Number(r.id)); else lihat.add(key);
  }
  out(`[1a] jurnal duplikat persis dihapus: ${hapusId.size} baris, nominal Rp${rp(jur.filter((r) => hapusId.has(Number(r.id))).reduce((s, r) => s + Number(r.n), 0))}`);
  for (const id of hapusId) stmts.push({ sql: 'DELETE FROM jurnal_transaksi WHERE id = ?', args: [id] });

  // 1b. invoice_sewa ganda (isi sama; null dianggap 0)
  const inv = (await db.execute('SELECT * FROM invoice_sewa ORDER BY id')).rows as any[];
  const sidik = (r: any) => Object.keys(r).filter((k) => isNaN(Number(k)) && !['id', 'created_at', 'updated_at'].includes(k)).map((k) => `${k}=${r[k] == null ? 0 : r[k]}`).join('|');
  const lihatInv = new Set<string>();
  const invHapus = new Set<number>();
  for (const r of inv) {
    const k = sidik(r);
    if (!lihatInv.has(k)) { lihatInv.add(k); continue; }
    const ada = (await db.execute({ sql: 'SELECT 1 FROM payment WHERE invoice_sewa_id = ?', args: [r.id] })).rows.length;
    if (ada) { out(`[1b] invoice id ${r.id} ganda tapi punya payment — dilewati`); continue; }
    invHapus.add(Number(r.id));
    out(`[1b] invoice ganda dihapus: id ${r.id} (${r.no_inv})`);
    stmts.push({ sql: 'DELETE FROM invoice_sewa WHERE id = ?', args: [r.id] });
  }

  // 2 & 3
  const sisa: J[] = jur.filter((r) => !hapusId.has(Number(r.id))).map((r) => ({ id: Number(r.id), tanggal: String(r.tanggal), debit: Number(r.d), kredit: Number(r.k), nominal: Number(r.n), ket: String(r.ket) }));
  const terpakai = new Set<number>();
  let konversi = 0, baru = 0;
  const manual: string[] = [];

  for (const r of inv) {
    if (invHapus.has(Number(r.id))) continue;
    const nama = String(r.nama), kamar = String(r.no_kamar), jb = int(r.jumlah_bulan);
    const t0 = String(r.tanggal_pembayaran).slice(0, 10);
    const awal = String(r.periode_awal ?? '').slice(0, 10);
    const ts = int(r.total_sewa), tl = int(r.total_listrik), td = int(r.total_denda);
    if (!awal || !jb) { manual.push(`${r.no_inv} ${nama}(${kamar}): periode kosong`); continue; }

    // sudah bentuk baru?
    if (sisa.some((j) => j.ket === `Terima sewa ${jb} bln dimuka ${nama} KTD ${kamar}` && j.tanggal === t0 && j.nominal === int(r.grand_total) - int(r.pajak) + (int(r.diskon) > 0 ? 0 : 0))) continue;
    if (sisa.some((j) => j.ket.startsWith('Terima sewa') && j.ket.endsWith(`${nama} KTD ${kamar}`) && j.tanggal === t0)) continue;

    const bayar = (await db.execute({ sql: 'SELECT 1 FROM payment WHERE invoice_sewa_id = ?', args: [r.id] })).rows.length > 0;
    const cocokNama = (token: string) => { const a = norm(nama), b = norm(token); return a.includes(b) || b.includes(a); };
    const grup = sisa
      .filter((j) => !terpakai.has(j.id) && !j.ket.includes('KTD') && !j.ket.includes('[s/d'))
      .map((j) => ({ j, m: lamaRe.exec(j.ket) }))
      .filter((x) => x.m && cocokNama(x.m[5]));
    const terima = grup.filter((x) => x.m![2] && x.j.tanggal === t0 && Number(x.m![2]) === jb);

    if (terima.length && terima.reduce((s, x) => s + x.j.nominal, 0) === ts + tl) {
      const token = norm(terima[0].m![5]);
      const peng = grup.filter((x) => x.m![3] && norm(x.m![5]) === token && x.j.tanggal >= t0);
      const pilih: typeof peng = [];
      for (let k = 1; k <= jb; k++) pilih.push(...peng.filter((x) => Number(x.m![3]) === k && !pilih.includes(x)).slice(0, tl > 0 ? 2 : 1));
      if (pilih.reduce((s, x) => s + x.j.nominal, 0) === ts + tl) {
        const baris = barisJurnalSewa({ kodeKas: terima[0].j.debit, nama, noKamar: kamar, tanggalBayar: t0, periodeAwal: awal, jumlahBulan: jb, totalSewa: ts, totalListrik: tl, totalDenda: td, diskon: int(r.diskon), pajak: int(r.pajak), grandTotal: int(r.grand_total) });
        for (const x of [...terima, ...pilih]) { terpakai.add(x.j.id); stmts.push({ sql: 'DELETE FROM jurnal_transaksi WHERE id = ?', args: [x.j.id] }); }
        tulis(baris);
        out(`[2] KONVERSI ${r.no_inv} ${nama}(${kamar}): ${terima.length + pilih.length} baris lama -> ${baris.length} baris baru`);
        konversi++;
        continue;
      }
    }

    const adaJejak = terima.length > 0 || sisa.some((j) => j.ket.includes(`${nama} (${kamar})`) && j.tanggal >= awal && j.tanggal <= t0.slice(0, 4) + '-12-31' && j.ket.includes('[s/d'));
    if (!adaJejak && bayar) {
      const baris = barisJurnalSewa({ kodeKas: 1103, nama, noKamar: kamar, tanggalBayar: t0, periodeAwal: awal, jumlahBulan: jb, totalSewa: ts, totalListrik: tl, totalDenda: td, diskon: int(r.diskon), pajak: int(r.pajak), grandTotal: int(r.grand_total) });
      tulis(baris);
      out(`[3] BUAT ${r.no_inv} ${nama}(${kamar}) mulai ${awal} ${jb}bln Rp${rp(int(r.grand_total))}: ${baris.length} baris`);
      baru++;
      continue;
    }
    manual.push(`${r.no_inv} ${nama}(${kamar}) bayar ${t0} mulai ${awal} ${jb}bln Rp${rp(int(r.grand_total))}${bayar ? '' : ' [tanpa payment]'}${terima.length ? ' [ada jurnal lama, angka beda]' : ''}`);
  }

  out(`\nPerlu dicek manual (${manual.length}):`);
  manual.forEach((m) => out('  ' + m));
  out(`\nRingkas: hapus jurnal ${hapusId.size}, hapus invoice ${invHapus.size}, konversi ${konversi}, jurnal baru ${baru}, manual ${manual.length}, total statement ${stmts.length}`);

  if (!commit) { out('DRY-RUN — tidak ada yang ditulis. Tambah --commit untuk menerapkan.'); return; }
  const tx = await db.transaction('write');
  try { for (const s of stmts) await tx.execute(s); await tx.commit(); out('SELESAI: diterapkan.'); }
  catch (e) { await tx.rollback().catch(() => {}); throw e; } finally { tx.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
