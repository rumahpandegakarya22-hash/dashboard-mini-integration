/* Rapikan jurnal sewa (arahan pemilik 10 Nov 2026). DRY-RUN default; --commit menulis dalam satu transaksi.
   Pakai: npx tsx scripts/rapikan-jurnal-sewa.ts [--commit]

   1. Nama lengkap: "Putri Hazna Nabilla" -> "Putri Hazna Nabila" (nama resmi di active_tenant) di semua tabel.
   2. Grisella (INV/4/TDU/6/2026): jurnal lama "Sella" diganti sesuai invoice (listrik 3 bulan).
   3. Hapus jurnal sewa/DP yang tidak punya invoice:
        - format lama bernama panggilan atau tanpa kamar,
        - Terima/Diskon/Pemakaian DP/Terima DP yang tidak cocok dengan invoice (nama, kamar, tanggal),
        - pengakuan di luar masa invoice, atau kelebihan pengakuan format lama (lump) yang sudah tercakup irisan baru.
   Hanya baris keluarga sewa/DP yang disentuh; pengeluaran dan jurnal lain tidak. */
import './_env';
import { turso } from '../src/lib/core/turso';
import { barisJurnalSewa } from '../src/lib/jurnal';
import { fmtTanggal, fmtTeks } from '../src/lib/format-tanggal';

const commit = process.argv.includes('--commit');
const int = (v: unknown) => Math.round(Number(v ?? 0)) || 0;
const rp = (n: number) => n.toLocaleString('id-ID');
const d10 = (v: unknown) => String(v ?? '').slice(0, 10);
const fix = (s: string) => s.replace(/Putri Hazna Nabilla/g, 'Putri Hazna Nabila');

const RE = {
  terima: /^Terima sewa (\d+) bln dimuka (.+) KTD (\S+)$/,
  diskon: /^Diskon sewa (.+) KTD (\S+)$/,
  pakaiDp: /^Pemakaian DP (.+) KTD (\S+)$/,
  terimaDp: /^Terima DP (.+) KTD (\S+)$/,
  pengakuan: /^Pengakuan sewa bln-(\d+) (Sewa|Listrik) (.+) \((\S+)\)( \[s\/d (\d{4}-\d{2}-\d{2})\])?$/,
  denda: /^Pengakuan denda (.+) \((\S+)\)$/,
  keluarga: /^(Terima sewa|Pengakuan sewa|Diskon sewa|Sewa Kamar|Pemakaian DP|Terima DP|Pengakuan denda|Pajak dipungut)/
};

async function main() {
  const db = turso();
  const out = (s: string) => console.log(s);
  const stmts: { sql: string; args: any[] }[] = [];

  // ---- 1. nama
  const TAB_NAMA: [string, string][] = [['occupancy_history', 'nama'], ['booking', 'nama_penyewa'], ['invoice_sewa', 'nama'], ['invoice_dp', 'nama'], ['kondisi_kamar', 'nama_penghuni']];
  for (const [t, c] of TAB_NAMA) stmts.push({ sql: `UPDATE ${t} SET ${c} = REPLACE(${c}, 'Putri Hazna Nabilla', 'Putri Hazna Nabila') WHERE ${c} LIKE '%Putri Hazna Nabilla%'`, args: [] });
  stmts.push({ sql: "UPDATE jurnal_transaksi SET keterangan = REPLACE(keterangan, 'Putri Hazna Nabilla', 'Putri Hazna Nabila') WHERE keterangan LIKE '%Putri Hazna Nabilla%'", args: [] });
  out('[1] nama "Putri Hazna Nabilla" -> "Putri Hazna Nabila" di 5 tabel + keterangan jurnal');

  const invRaw = (await db.execute('SELECT * FROM invoice_sewa')).rows as any[];
  const dp = (await db.execute('SELECT * FROM invoice_dp')).rows as any[];
  const at = (await db.execute('SELECT id_penghuni, nama_lengkap n FROM active_tenant')).rows as any[];
  const oh = (await db.execute('SELECT id_penghuni, nama n FROM occupancy_history')).rows as any[];
  const canon = new Map<string, string>();
  for (const o of oh) canon.set(String(o.id_penghuni), fix(String(o.n)));
  for (const a of at) canon.set(String(a.id_penghuni), String(a.n));
  const inv = invRaw.map((r) => ({ ...r, nm: canon.get(String(r.id_penghuni)) ?? fix(String(r.nama)), kamar: String(r.no_kamar) }));
  const jur = ((await db.execute('SELECT id, tanggal, akun_debit_kode d, akun_kredit_kode k, nominal n, keterangan ket FROM jurnal_transaksi ORDER BY id')).rows as any[]).map((r) => ({ id: Number(r.id), tgl: d10(r.tanggal), d: Number(r.d), k: Number(r.k), n: Number(r.n), ket: fix(String(r.ket)) }));

  // ---- 2. Grisella Juni
  const gris = inv.find((r) => r.no_inv === 'INV/4/TDU/6/2026');
  const grisSudah = gris && jur.some((j) => j.ket === `Terima sewa ${int(gris.jumlah_bulan)} bln dimuka ${gris.nm} KTD ${gris.kamar}` && j.tgl === d10(gris.tanggal_pembayaran));
  if (gris && !grisSudah) {
    const baris = barisJurnalSewa({
      kodeKas: 1103, nama: gris.nm, noKamar: gris.kamar, tanggalBayar: d10(gris.tanggal_pembayaran), periodeAwal: d10(gris.periode_awal),
      jumlahBulan: int(gris.jumlah_bulan), totalSewa: int(gris.total_sewa), totalListrik: int(gris.total_listrik), totalDenda: int(gris.total_denda),
      diskon: int(gris.diskon), pajak: int(gris.pajak), grandTotal: int(gris.grand_total)
    });
    for (const b of baris) stmts.push({ sql: 'INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori) VALUES (?,?,?,?,?,?)', args: [b.tanggal, b.debit, b.kredit, b.nominal, b.keterangan, b.kategori] });
    out(`[2] Grisella INV/4/TDU/6/2026: ${baris.length} baris baru sesuai invoice (jurnal lama "Sella" 49-54 dihapus pada langkah 3)`);
  }

  // ---- 3. jurnal tanpa invoice
  const hapus = new Map<number, string>();
  const tandai = (id: number, alasan: string) => { if (!hapus.has(id)) hapus.set(id, alasan); };
  const cocokInv = (nm: string, kamar: string) => inv.filter((r) => r.nm === nm && r.kamar === kamar);

  for (const j of jur) {
    if (!RE.keluarga.test(j.ket)) continue;
    let m: RegExpExecArray | null;
    if ((m = RE.terima.exec(j.ket))) {
      if (!cocokInv(m[2], m[3]).some((r) => d10(r.tanggal_pembayaran) === j.tgl && int(r.jumlah_bulan) === Number(m![1]))) tandai(j.id, 'Terima tanpa invoice');
    } else if ((m = RE.diskon.exec(j.ket))) {
      if (!cocokInv(m[1], m[2]).some((r) => d10(r.periode_awal) === j.tgl)) tandai(j.id, 'Diskon tanpa invoice');
    } else if ((m = RE.pakaiDp.exec(j.ket))) {
      if (!cocokInv(m[1], m[2]).some((r) => d10(r.tanggal_pembayaran) === j.tgl)) tandai(j.id, 'Pemakaian DP tanpa invoice');
    } else if ((m = RE.terimaDp.exec(j.ket))) {
      if (!dp.some((r) => (canon.get(String(r.id_penghuni)) ?? fix(String(r.nama))) === m![1] && String(r.no_kamar) === m![2] && d10(r.tanggal_pembayaran) === j.tgl)) tandai(j.id, 'Terima DP tanpa invoice DP');
    } else if ((m = RE.pengakuan.exec(j.ket))) {
      if (!cocokInv(m[3], m[4]).some((r) => j.tgl >= d10(r.periode_awal) && j.tgl <= d10(r.periode_akhir))) tandai(j.id, 'Pengakuan di luar masa invoice');
    } else if ((m = RE.denda.exec(j.ket))) {
      if (!cocokInv(m[1], m[2]).some((r) => int(r.total_denda) > 0 && d10(r.tanggal_pembayaran) === j.tgl)) tandai(j.id, 'Denda tanpa invoice');
    } else if (!/^Pajak dipungut/.test(j.ket)) {
      tandai(j.id, 'Format lama / tanpa nomor kamar (tidak terkait invoice)');
    }
  }

  // kelebihan pengakuan per penghuni: sisihkan lump format lama (tanpa [s/d]) bila total sudah melebihi tagihan
  const perPenghuni = new Map<string, { rows: typeof jur; expected: number }>();
  for (const r of inv) {
    const key = `${r.nm}|${r.kamar}`;
    const e = perPenghuni.get(key) ?? { rows: [], expected: 0 };
    e.expected += int(r.total_sewa) + int(r.total_listrik);
    perPenghuni.set(key, e);
  }
  for (const j of jur) {
    if (hapus.has(j.id)) continue;
    const m = RE.pengakuan.exec(j.ket);
    if (!m) continue;
    perPenghuni.get(`${m[3]}|${m[4]}`)?.rows.push(j);
  }
  for (const [key, e] of perPenghuni) {
    let aktual = e.rows.reduce((s, j) => s + j.n, 0);
    if (aktual <= e.expected) continue;
    const lump = e.rows.filter((j) => !RE.pengakuan.exec(j.ket)![5]).sort((a, b) => b.tgl.localeCompare(a.tgl) || b.id - a.id);
    for (const j of lump) { if (aktual <= e.expected) break; tandai(j.id, 'Kelebihan pengakuan format lama'); aktual -= j.n; }
    if (aktual > e.expected) out(`   ! ${key}: pengakuan masih lebih Rp${rp(aktual - e.expected)} dari tagihan — periksa manual`);
  }

  const dipilih = jur.filter((j) => hapus.has(j.id));
  const ringkas = new Map<string, number>();
  for (const j of dipilih) ringkas.set(hapus.get(j.id)!, (ringkas.get(hapus.get(j.id)!) ?? 0) + 1);
  out(`[3] jurnal tanpa invoice yang dihapus: ${dipilih.length} baris`);
  ringkas.forEach((n, a) => out(`      ${n} baris — ${a}`));
  const efek = (kode: number, sisi: 'd' | 'k') => dipilih.filter((j) => j[sisi] === kode).reduce((s, j) => s + j.n, 0);
  out(`      kas 1103 berkurang Rp${rp(efek(1103, 'd'))} | pendapatan 4101 berkurang Rp${rp(efek(4101, 'k'))} | 2105: debit Rp${rp(efek(2105, 'd'))} / kredit Rp${rp(efek(2105, 'k'))} | 2104 debit Rp${rp(efek(2104, 'd'))} / kredit Rp${rp(efek(2104, 'k'))}`);
  if (process.argv.includes('--rinci')) for (const j of dipilih) out(`      #${j.id} ${fmtTanggal(j.tgl)} ${j.n} ${fmtTeks(j.ket)}  <${hapus.get(j.id)}>`);
  for (const j of dipilih) stmts.push({ sql: 'DELETE FROM jurnal_transaksi WHERE id = ?', args: [j.id] });

  out(`\nTotal statement: ${stmts.length}`);
  if (!commit) { out('DRY-RUN — tidak ada yang ditulis.'); return; }
  const tx = await db.transaction('write');
  try { for (const s of stmts) await tx.execute(s); await tx.commit(); out('SELESAI: diterapkan.'); }
  catch (e) { await tx.rollback().catch(() => {}); throw e; } finally { tx.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
