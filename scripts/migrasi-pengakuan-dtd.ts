/* Ubah baris pengakuan sewa lama (sebulan penuh per tanggal mulai) menjadi irisan per bulan kalender
   dengan penanda "[s/d tgl]" supaya dashboard bisa mengakui pendapatan date-to-date.
   Hanya baris "Pengakuan sewa" yang dicocokkan penuh dengan invoice yang diubah; sisanya dilewati.
   DRY-RUN default. Pakai: npx tsx scripts/migrasi-pengakuan-dtd.ts [--commit] */
import './_env';
import { turso } from '../src/lib/core/turso';
import { barisJurnalSewa, type BarisJurnal } from '../src/lib/jurnal';

const commit = process.argv.includes('--commit');
const int = (v: unknown) => Math.round(Number(v ?? 0)) || 0;

const bangunLamaSewa = (l: any, lama = false): BarisJurnal[] =>
  barisJurnalSewa({
    kodeKas: 0, nama: l.nama, noKamar: l.no_kamar, tanggalBayar: String(l.tanggal_pembayaran), periodeAwal: String(l.periode_awal),
    jumlahBulan: int(l.jumlah_bulan) || 1, totalSewa: int(l.total_sewa), totalListrik: int(l.total_listrik),
    totalDenda: int(l.total_denda), diskon: int(l.diskon), pajak: int(l.pajak), grandTotal: int(l.grand_total), lama
  });

/** Baris jurnal DB untuk tiap baris yang diharapkan (tanggal+keterangan+nominal), tanpa id ganda; null bila ada yang hilang. */
async function cocokkanJurnal(baris: BarisJurnal[]): Promise<{ ids: number[] } | null> {
  const ids: number[] = [];
  for (const b of baris) {
    const pakai = ids.length ? ` AND id NOT IN (${ids.map(() => '?').join(',')})` : '';
    const r = await turso().execute({
      sql: `SELECT id FROM jurnal_transaksi WHERE tanggal = ? AND keterangan = ? AND nominal = ?${pakai} ORDER BY id LIMIT 1`,
      args: [b.tanggal, b.keterangan, b.nominal, ...ids]
    });
    if (!r.rows[0]) return null;
    ids.push(Number(r.rows[0].id));
  }
  return { ids };
}

async function main() {
  const db = turso();
  const inv = (await db.execute('SELECT * FROM invoice_sewa ORDER BY id')).rows as any[];
  let diubah = 0, sudah = 0, lewat = 0;
  for (const l of inv) {
    if (!l.periode_awal || !int(l.jumlah_bulan)) { lewat++; continue; }
    if (await cocokkanJurnal(bangunLamaSewa(l))) { sudah++; continue; } // sudah bentuk baru
    const lama = bangunLamaSewa(l, true);
    const cari = await cocokkanJurnal(lama);
    if (!cari) { lewat++; console.log(`LEWATI ${l.no_inv} ${l.nama}: jurnal lama tidak cocok`); continue; }
    const idPengakuan = cari.ids.filter((_, i) => lama[i].keterangan.startsWith('Pengakuan sewa'));
    const baru = bangunLamaSewa(l).filter((b) => b.keterangan.startsWith('Pengakuan sewa'));
    console.log(`${commit ? 'UBAH' : 'AKAN UBAH'} ${l.no_inv} ${l.nama}: ${idPengakuan.length} baris -> ${baru.length} irisan`);
    diubah++;
    if (!commit) continue;
    const tx = await db.transaction('write');
    try {
      for (const id of idPengakuan) await tx.execute({ sql: 'DELETE FROM jurnal_transaksi WHERE id = ?', args: [id] });
      for (const b of baru) {
        await tx.execute({
          sql: 'INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori) VALUES (?,?,?,?,?,?)',
          args: [b.tanggal, b.debit, b.kredit, b.nominal, b.keterangan, b.kategori]
        });
      }
      await tx.commit();
    } catch (e) { await tx.rollback().catch(() => {}); throw e; } finally { tx.close(); }
  }
  console.log(`\n${commit ? 'Selesai' : 'DRY-RUN'}: diubah ${diubah}, sudah baru ${sudah}, dilewati ${lewat}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
