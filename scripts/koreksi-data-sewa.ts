/* Koreksi data sewa/DP sesuai arahan pemilik (9 Nov 2026). DRY-RUN default; --commit menulis dalam SATU transaksi.
   Pakai: npx tsx scripts/koreksi-data-sewa.ts [--commit]

   A. 10 invoice sudah dibayar, jurnal belum ada  -> buat jurnal (kas 1103)
   B. Bunga (19) & Sukma (10): DP Rp300.000 sudah masuk, tunai = invoice - DP -> payment + jurnal (ganti jurnal lama)
   C. 19 invoice "sudah dibayar" tanpa payment/jurnal -> buat payment + jurnal (Dini id 84: ganti jurnal lama 127/128)
   D. Semua invoice DP -> jurnal terima DP (kas 1103 / 2104). DP yang dipakai memotong sewa (invoice dengan diskon = DP,
      plus Bunga & Sukma) -> Debit 2104 / Kredit 2105, bukan Beban Diskon.
   E. Delinda 850.000 (id jurnal 13): tambah penerimaan kas.
   G. Nomor invoice ganda Dini Ariva (id 84) diganti -B.
   Nama: jurnal baru memakai nama dari occupancy_history; salah ketik "Putri Hazna Nabila" & "Dina Riva" dibetulkan. */
import './_env';
import { turso } from '../src/lib/core/turso';
import { barisJurnalSewa, type BarisJurnal } from '../src/lib/jurnal';
import { fmtTanggal, fmtTeks } from '../src/lib/format-tanggal';

const commit = process.argv.includes('--commit');
const KAS = 1103, DP_AKUN = 2104, DIMUKA = 2105;
const int = (v: unknown) => Math.round(Number(v ?? 0)) || 0;
const rp = (n: number) => n.toLocaleString('id-ID');
const d10 = (v: unknown) => String(v ?? '').slice(0, 10);
const INS = 'INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori) VALUES (?,?,?,?,?,?)';

// id invoice_sewa yang dikoreksi (no_inv + nama, karena no_inv bisa ganda)
const GRUP_A = ['INV/12/TDU/5/2026', 'INV/13/TDU/6/2026', 'INV/4/TDU/6/2026', 'INV/16/TDU/5/2026', 'INV/24/TDU/4/2026', 'INV/5/TDU/6/2026', 'INV/11/TDU/7/2026', 'INV/26/TDU/6/2026', 'INV/15/TDU/6/2026', 'INV/1/TDU/5/2026'];
const GRUP_B = ['INV/19/TDU/6/2026', 'INV/10/TDU/6/2026'];
const GRUP_C = ['INV/18/TDU/6/2026', 'INV/8/TDU/6/2026', 'INV/31/TDU/7/2026#Dini', 'INV/13/TDU/4/2026', 'INV/13/TDU/5/2026', 'INV/13/TDU/7/2026', 'INV/6/TDU/6/2026', 'INV/6/TDU/7/2026', 'INV/4/TDU/3/2026', 'INV/16/TDU/7/2026', 'INV/20/TDU/6/2026', 'INV/23/TDU/6/2026', 'INV/7/TDU/6/2026', 'INV/9/TDU/8/2026', 'INV/15/TDU/5/2026', 'INV/15/TDU/7/2026', 'INV/1/TDU/7/2026', 'INV/29/TDU/7/2026', 'INV/22/TDU/6/2026'];
const lamaRe = /^(Terima sewa (\d+) bln dimuka|Pengakuan sewa bln-(\d+)) (?:(Sewa|Listrik|Listrk Kamar) )?(.+)$/;

async function main() {
  const db = turso();
  const stmts: { sql: string; args: any[] }[] = [];
  const lapor: string[] = [];
  const out = (s: string) => console.log(s);
  const add = (sql: string, args: any[]) => stmts.push({ sql, args });
  const tulis = (baris: BarisJurnal[]) => baris.forEach((b) => add(INS, [b.tanggal, b.debit, b.kredit, b.nominal, b.keterangan, b.kategori]));

  const inv = (await db.execute('SELECT * FROM invoice_sewa ORDER BY id')).rows as any[];
  const dp = (await db.execute('SELECT * FROM invoice_dp ORDER BY id')).rows as any[];
  const occ = (await db.execute('SELECT id_penghuni, nama, no_kamar FROM occupancy_history')).rows as any[];
  const pay = new Set((await db.execute('SELECT invoice_sewa_id i FROM payment WHERE invoice_sewa_id IS NOT NULL')).rows.map((r) => Number(r.i)));
  const jur = (await db.execute('SELECT id, tanggal, keterangan ket, nominal n FROM jurnal_transaksi')).rows as any[];

  const namaResmi = (idP: unknown, fallback: string) => String(occ.find((o) => o.id_penghuni === idP)?.nama ?? fallback);
  const cari = (kode: string) => {
    const [no, nama] = kode.split('#');
    return inv.find((r) => r.no_inv === no && (!nama || String(r.nama).startsWith(nama)));
  };

  // DP per penghuni (kunci: id_penghuni; DP "Dina Riva" -> id Dini Ariva)
  const dpPerPenghuni = new Map<string, number>();
  for (const d of dp) dpPerPenghuni.set(String(d.id_penghuni), (dpPerPenghuni.get(String(d.id_penghuni)) ?? 0) + int(d.grand_total));
  const pertama = new Map<string, any>();
  for (const r of [...inv].sort((a, b) => d10(a.tanggal_pembayaran).localeCompare(d10(b.tanggal_pembayaran)) || a.id - b.id)) if (!pertama.has(String(r.id_penghuni))) pertama.set(String(r.id_penghuni), r);
  // DP dianggap memotong sewa bila diskon pada invoice pertama penghuni = nilai DP-nya.
  const dpDipakai = (r: any): number => {
    if (pertama.get(String(r.id_penghuni))?.id !== r.id) return 0;
    const nilaiDp = dpPerPenghuni.get(String(r.id_penghuni)) ?? 0;
    return nilaiDp > 0 && int(r.diskon) === nilaiDp ? nilaiDp : 0;
  };

  const bangun = (r: any, dpPaksa?: number): { baris: BarisJurnal[]; tunai: number; dpPakai: number } => {
    const dpPakai = dpPaksa ?? dpDipakai(r);
    const diskonAsli = dpPaksa !== undefined ? int(r.diskon) : int(r.diskon) - dpPakai;
    const nama = namaResmi(r.id_penghuni, String(r.nama));
    const baris = barisJurnalSewa({
      kodeKas: KAS, nama, noKamar: String(r.no_kamar), tanggalBayar: d10(r.tanggal_pembayaran), periodeAwal: d10(r.periode_awal),
      jumlahBulan: int(r.jumlah_bulan), totalSewa: int(r.total_sewa), totalListrik: int(r.total_listrik), totalDenda: int(r.total_denda),
      diskon: diskonAsli, pajak: int(r.pajak), grandTotal: int(r.grand_total)
    });
    if (dpPakai > 0) {
      baris[0] = { ...baris[0], nominal: baris[0].nominal - dpPakai };
      baris.splice(1, 0, { tanggal: d10(r.tanggal_pembayaran), debit: DP_AKUN, kredit: DIMUKA, nominal: dpPakai, keterangan: `Pemakaian DP ${nama} KTD ${r.no_kamar}`, kategori: 'Operasional' });
    }
    const tunai = dpPaksa !== undefined ? int(r.grand_total) - dpPaksa : int(r.grand_total);
    return { baris, tunai, dpPakai };
  };

  // Jurnal lama bernama panggilan ("Sewa Sella", "Listrik Keiza"): cocok bila tanggal terima = tanggal bayar,
  // nama panggilan merupakan awal/akhir salah satu kata nama penghuni, dan nominalnya = tagihan (atau tagihan - DP).
  const terpakai = new Set<number>();
  const cariLama = (r: any): { ids: number[]; cash: number } | 'beda' | null => {
    const t0 = d10(r.tanggal_pembayaran);
    const kata = String(r.nama).toLowerCase().split(/\s+/);
    const jb = int(r.jumlah_bulan), tot = int(r.total_sewa) + int(r.total_listrik);
    const dpT = dpPerPenghuni.get(String(r.id_penghuni)) ?? 0;
    const lama = jur
      .filter((j) => !terpakai.has(Number(j.id)) && !String(j.ket).includes('KTD') && !String(j.ket).includes('[s/d'))
      .map((j) => ({ j, m: lamaRe.exec(String(j.ket)) }))
      .filter((x) => x.m && x.m[5].trim().length >= 4 && kata.some((w) => w.startsWith(x.m![5].trim().toLowerCase()) || w.endsWith(x.m![5].trim().toLowerCase())));
    const tMax = new Date(Date.parse(`${t0}T00:00:00Z`) + 3 * 86400000).toISOString().slice(0, 10);
    const terima = lama.filter((x) => x.m![2] && d10(x.j.tanggal) >= t0 && d10(x.j.tanggal) <= tMax); // jurnal lama kadang selisih 1-2 hari dari tanggal invoice
    if (!terima.length) return null;
    for (const token of new Set(terima.map((x) => x.m![5].trim().toLowerCase()))) {
      const tr = terima.filter((x) => x.m![5].trim().toLowerCase() === token);
      const cash = tr.reduce((sum, x) => sum + Number(x.j.n), 0);
      // pengakuan: per (jenis, bulan ke-k) ambil baris paling awal pada/setelah tanggal terima — set lama yang lain tidak ikut
      const kandidat = lama.filter((x) => x.m![3] && x.m![5].trim().toLowerCase() === token && d10(x.j.tanggal) >= t0).sort((p, q) => d10(p.j.tanggal).localeCompare(d10(q.j.tanggal)) || Number(p.j.id) - Number(q.j.id));
      const peng: typeof kandidat = [];
      for (const jenis of new Set(tr.map((x) => x.m![4] ?? ''))) {
        for (let k = 1; k <= jb; k++) {
          const hit = kandidat.find((x) => (x.m![4] ?? '') === jenis && Number(x.m![3]) === k && !peng.includes(x));
          if (hit) peng.push(hit);
        }
      }
      const sumP = peng.reduce((sum, x) => sum + Number(x.j.n), 0);
      const boleh = new Set([tot, int(r.grand_total), ...(dpT > 0 ? [tot - dpT, int(r.grand_total) - dpT] : [])]);
      if (boleh.has(cash) && sumP === cash) {
        return { ids: [...tr, ...peng].map((x) => Number(x.j.id)), cash };
      }
    }
    return 'beda';
  };

  const buatPayment = (r: any, tunai: number, noInv: string) =>
    add(`INSERT INTO payment (id_payment, id_penghuni, invoice_dp_id, invoice_sewa_id, periode_awal, periode_akhir, amount, payment_date, status, notes)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'Paid', ?)`,
      [noInv, r.id_penghuni, r.id, d10(r.periode_awal), d10(r.periode_akhir), tunai, d10(r.tanggal_pembayaran), 'Akun kas/bank: Rekening Ops (koreksi data 9 Nov 2026)']);

  const sudahFormatBaru = (r: any) =>
    jur.some((j) => String(j.ket).startsWith('Terima sewa') && String(j.ket).endsWith(`${namaResmi(r.id_penghuni, String(r.nama))} KTD ${r.no_kamar}`) && d10(j.tanggal) === d10(r.tanggal_pembayaran));

  // ---- G: nomor ganda Dini Ariva
  const dini = cari('INV/31/TDU/7/2026#Dini');
  const noDiniBaru = 'INV/31/TDU/7/2026-B';
  if (dini) { add('UPDATE invoice_sewa SET no_inv = ? WHERE id = ?', [noDiniBaru, dini.id]); out(`[G] invoice id ${dini.id} Dini Ariva: nomor -> ${noDiniBaru}`); dini.no_inv = noDiniBaru; }

  // ---- A, B, C
  const proses = async (kode: string, grup: string) => {
    const r = cari(kode.replace('INV/31/TDU/7/2026#Dini', noDiniBaru + '#Dini')) ?? cari(kode);
    if (!r) { lapor.push(`${grup} ${kode}: invoice tidak ditemukan`); return; }
    if (r.id !== dini?.id && sudahFormatBaru(r)) { lapor.push(`${grup} ${r.no_inv} ${r.nama}: sudah punya jurnal format baru — dilewati`); return; }
    const hapus: number[] = [];
    let dpPaksa: number | undefined;
    if (r.id === dini?.id) hapus.push(127, 128);
    else {
      const lm = cariLama(r);
      if (lm === 'beda') { lapor.push(`${grup} ${r.no_inv} ${r.nama}(${r.no_kamar}): ada jurnal lama bernama panggilan tapi nominalnya tidak sama dengan invoice — dilewati, periksa manual`); return; }
      if (lm) {
        lm.ids.forEach((id) => { hapus.push(id); terpakai.add(id); });
        const tot = int(r.total_sewa) + int(r.total_listrik);
        const dpT = dpPerPenghuni.get(String(r.id_penghuni)) ?? 0;
        if (lm.cash === tot - dpT && dpT > 0) dpPaksa = dpT;
      }
    }
    const { baris, tunai, dpPakai } = bangun(r, dpPaksa);
    hapus.forEach((id) => add('DELETE FROM jurnal_transaksi WHERE id = ?', [id]));
    tulis(baris);
    if (!pay.has(Number(r.id))) buatPayment(r, tunai, String(r.no_inv));
    out(`[${grup}] ${r.no_inv} ${namaResmi(r.id_penghuni, r.nama)}(${r.no_kamar}) bayar ${fmtTanggal(d10(r.tanggal_pembayaran))}: tunai Rp${rp(tunai)}${dpPakai ? ` + DP Rp${rp(dpPakai)}` : ''}, ${baris.length} baris${hapus.length ? `, ganti ${hapus.length} jurnal lama` : ''}${pay.has(Number(r.id)) ? '' : ', + payment'}`);
  };
  for (const k of GRUP_A) await proses(k, 'A');
  for (const k of GRUP_B) await proses(k, 'B');
  for (const k of GRUP_C) await proses(k, 'C');

  // ---- D: jurnal terima DP semua invoice DP
  let dpTotal = 0, dpJumlah = 0;
  for (const d of dp) {
    const nama = namaResmi(d.id_penghuni, String(d.nama));
    add(INS, [d10(d.tanggal_pembayaran), KAS, DP_AKUN, int(d.grand_total), `Terima DP ${nama} KTD ${d.no_kamar}`, 'Operasional']);
    dpTotal += int(d.grand_total); dpJumlah++;
  }
  out(`[D] jurnal terima DP: ${dpJumlah} invoice, Rp${rp(dpTotal)} (Debit 1103 / Kredit 2104)`);
  // diskon yang sebenarnya DP pada jurnal yang SUDAH ada (Ulum, id jurnal 222)
  const ulum = jur.find((j) => Number(j.id) === 222 && String(j.ket).startsWith('Diskon sewa Ulum'));
  if (ulum) { add("UPDATE jurnal_transaksi SET akun_debit_kode = ?, keterangan = ? WHERE id = 222", [DP_AKUN, 'Pemakaian DP Ulum Orizhasativa Widianti KTD 25']); out('[D] jurnal 222 (Ulum): Beban Diskon -> Pemakaian DP (Debit 2104)'); }

  // ---- E: Delinda
  add(INS, ['2026-04-01', KAS, DIMUKA, 850000, 'Terima sewa Kamar Delinda', 'Operasional']);
  out('[E] Delinda: tambah penerimaan Rp850.000 (Debit 1103 / Kredit 2105) tgl 01 Apr 2026');

  // ---- nama salah ketik
  add("UPDATE invoice_sewa SET nama = 'Putri Hazna Nabilla' WHERE nama = 'Putri Hazna Nabila' AND id_penghuni = 'KTD-2604-003'", []);
  add("UPDATE jurnal_transaksi SET keterangan = REPLACE(keterangan, 'Putri Hazna Nabila ', 'Putri Hazna Nabilla ') WHERE keterangan LIKE '%Putri Hazna Nabila %'", []);
  const diniDp = dp.find((d) => d.nama === 'Dina Riva');
  if (diniDp) { add("UPDATE invoice_dp SET nama = ? WHERE id = ?", [namaResmi(diniDp.id_penghuni, 'Dini Ariva'), diniDp.id]); out(`[nama] invoice DP id ${diniDp.id} "Dina Riva" -> ${namaResmi(diniDp.id_penghuni, 'Dini Ariva')}`); }
  out('[nama] "Putri Hazna Nabila" -> "Putri Hazna Nabilla" (invoice + keterangan jurnal)');

  out(`\nPerlu perhatian (${lapor.length}):`);
  lapor.forEach((l) => out('  ' + l));
  out(`\nTotal statement: ${stmts.length}`);
  if (!commit) { out('DRY-RUN — tidak ada yang ditulis.'); return; }
  const tx = await db.transaction('write');
  try { for (const s of stmts) await tx.execute({ sql: s.sql, args: s.args }); await tx.commit(); out('SELESAI: diterapkan.'); }
  catch (e) { await tx.rollback().catch(() => {}); throw e; } finally { tx.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
