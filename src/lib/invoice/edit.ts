import { turso } from '../core/turso';
import { withLock } from '../core/redis';
import { getInvoiceSewaMaster } from '../master';
import { barisJurnalDp, barisJurnalSewa, kodeAkunKas, type BarisJurnal } from '../jurnal';
import { addMonthsSewa, toISO } from '../modules/handlers/pembayaran-sewa-preview';
import { parseDateISO } from '../core/validate';
import { balikBarisJurnal, cekAlasan, dalamTransaksi, idJurnalGrup, nomorKoreksi } from '../koreksi';
import { getInvoiceDp, getInvoiceSewa } from './data';
import { fmtTanggal } from '../format-tanggal';

export type InputEditInvoice = {
  noInv: string;
  jenis: 'DP' | 'Sewa';
  email: string;
  tanggalBayar: string;
  periodeAwal?: string;
  jumlahBulan?: number;
  jumlahDenda?: number;
  dendaPerUnit?: number;
  diskon: number;
  pajak: number;
  /** Kosong = pakai akun kas yang sudah tercatat di jurnal lama. */
  akunKasBank?: string;
};

export type HasilKoreksiInvoice = { jenis: 'DP' | 'Sewa'; sebelum: unknown; sesudah: unknown; noInvBaru: string };

const int = (v: unknown) => Math.round(Number(v ?? 0)) || 0;

/* =========================================================================
   Void dan koreksi pembayaran (tidak ada edit di tempat).

   - Void   : invoice ditandai void, payment dibatalkan (Cancelled), dan SEMUA
              baris jurnalnya dibalik dengan baris pembalik.
   - Koreksi: void invoice lama + invoice BARU bernomor <asal>-K1, -K2, ...
              (id_payment = nomor invoice, jadi nomor baru wajib), payment dan
              jurnal baru. Semua dalam satu transaksi database.

   Baris jurnal lama ditemukan lewat grup_id (= nomor invoice untuk pembayaran
   yang dicatat setelah fitur ini). Untuk pembayaran lama tanpa grup_id, baris
   dicari dengan membangun ULANG baris yang seharusnya dibuat (fungsi yang sama
   dengan saat input) dan mencocokkan tanggal+keterangan+nominal. Bila ada satu
   baris saja yang tidak ketemu (mis. jurnal bikinan manual), proses DIBATALKAN
   dan admin diminta membalik jurnal manual lewat Aktivitas Finansial — jurnal
   setengah dibalik lebih berbahaya daripada tidak diubah sama sekali.
   ========================================================================= */

type Ctx = {
  jenis: 'DP' | 'Sewa';
  tabel: 'invoice_sewa' | 'invoice_dp';
  kolomPayment: 'invoice_sewa_id' | 'invoice_dp_id';
  idRow: number;
  noInv: string;
};

async function muatKonteks(noInv: string, jenis: 'DP' | 'Sewa'): Promise<Ctx> {
  const tabel = jenis === 'Sewa' ? 'invoice_sewa' : 'invoice_dp';
  const rs = await turso().execute({
    sql: `SELECT id, void_pada FROM ${tabel} WHERE no_inv = ? ORDER BY id DESC LIMIT 1`,
    args: [noInv]
  });
  const r = rs.rows[0];
  if (!r) throw new Error(`Invoice ${noInv} tidak ditemukan.`);
  if (r.void_pada) throw new Error(`Invoice ${noInv} sudah di-void.`);
  return {
    jenis,
    tabel,
    kolomPayment: jenis === 'Sewa' ? 'invoice_sewa_id' : 'invoice_dp_id',
    idRow: Number(r.id),
    noInv
  };
}

/** Id baris jurnal aktif milik invoice ini + kode akun kas yang dipakai; melempar bila tidak bisa dipastikan. */
async function jurnalInvoice(c: Ctx, lama: unknown): Promise<{ ids: number[]; kodeKas: number }> {
  let ids = await idJurnalGrup(c.noInv);
  let kodeKas = 0;
  if (ids.length) {
    const r = await turso().execute({ sql: 'SELECT akun_debit_kode FROM jurnal_transaksi WHERE id = ?', args: [ids[0]] });
    kodeKas = Number(r.rows[0]?.akun_debit_kode ?? 0);
  } else {
    let cari = await cocokkanJurnal(c.jenis === 'Sewa' ? bangunLamaSewa(lama as any) : bangunLamaDp(lama as any));
    if (!cari && c.jenis === 'Sewa') cari = await cocokkanJurnal(bangunLamaSewa(lama as any, true));
    if (!cari) {
      throw new Error(
        `Jurnal untuk ${c.noInv} tidak dapat dicocokkan otomatis (mungkin diinput manual). Void/koreksi dibatalkan agar jurnal tidak setengah dibalik — balik jurnalnya manual lewat Aktivitas Finansial dulu.`
      );
    }
    ids = cari.ids;
    kodeKas = cari.kodeKas;
  }
  return { ids, kodeKas };
}

export function voidInvoice(p: { noInv: string; jenis: 'DP' | 'Sewa'; alasan: string; oleh: string }): Promise<{ jenis: 'DP' | 'Sewa'; sebelum: unknown }> {
  return withLock(`edit-inv:${p.noInv}`, 20, async () => {
    const alasan = cekAlasan(p.alasan);
    const c = await muatKonteks(p.noInv, p.jenis);
    const lama = p.jenis === 'Sewa' ? await getInvoiceSewa(p.noInv) : await getInvoiceDp(p.noInv);
    const { ids } = await jurnalInvoice(c, lama);
    await dalamTransaksi(async (tx) => {
      await balikBarisJurnal(tx, ids, `Void ${p.noInv}: ${alasan}`);
      await tandaiVoid(tx, c, alasan, p.oleh);
    });
    return { jenis: p.jenis, sebelum: lama };
  });
}

async function tandaiVoid(tx: Parameters<Parameters<typeof dalamTransaksi>[0]>[0], c: Ctx, alasan: string, oleh: string) {
  await tx.execute({
    sql: `UPDATE ${c.tabel} SET void_pada = CURRENT_TIMESTAMP, void_oleh = ?, void_alasan = ? WHERE id = ?`,
    args: [oleh, alasan, c.idRow]
  });
  await tx.execute({
    sql: `UPDATE payment SET status = 'Cancelled', notes = COALESCE(notes || ' | ', '') || ? WHERE ${c.kolomPayment} = ?`,
    args: [`VOID: ${alasan}`.slice(0, 200), c.idRow]
  });
}

export function koreksiInvoice(input: InputEditInvoice & { oleh: string }): Promise<HasilKoreksiInvoice> {
  return withLock(`edit-inv:${input.noInv}`, 20, () => jalankan(input));
}

async function jalankan(input: InputEditInvoice & { oleh: string }): Promise<HasilKoreksiInvoice> {
  const { noInv, jenis } = input;
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Email tidak valid: "${email}".`);
  const tanggalBayar = parseDateISO(input.tanggalBayar);
  const diskon = int(input.diskon);
  const pajak = int(input.pajak);
  if (diskon < 0 || pajak < 0) throw new Error('Diskon dan pajak tidak boleh negatif.');

  const c = await muatKonteks(noInv, jenis);
  const lama = jenis === 'Sewa' ? await getInvoiceSewa(noInv) : await getInvoiceDp(noInv);
  if (!lama) throw new Error(`Invoice ${noInv} tidak ditemukan.`);

  // ---- hitung nilai baru ----
  let subtotal: number;
  let setSql: string;
  let setArgs: (string | number | null)[];
  let periodeAwal: string | null = null;
  let periodeAkhir: string | null = null;
  let barisBaru: (kodeKas: number, grup: string) => BarisJurnal[];

  if (jenis === 'Sewa') {
    const l = lama as NonNullable<Awaited<ReturnType<typeof getInvoiceSewa>>>;
    periodeAwal = parseDateISO(input.periodeAwal ?? '');
    const bulan = int(input.jumlahBulan);
    if (bulan < 1) throw new Error('Lama sewa tidak valid.');
    periodeAkhir = toISO(addMonthsSewa(new Date(`${periodeAwal}T00:00:00`), bulan));

    let hargaSewa = int(l.harga_sewa);
    if (bulan !== int(l.jumlah_bulan)) {
      const { harga } = await getInvoiceSewaMaster();
      hargaSewa = harga[String(l.tipe_kamar)]?.[bulan] || 0;
      if (!hargaSewa) throw new Error(`Harga tipe "${l.tipe_kamar}" untuk ${bulan} bulan tidak ditemukan di master harga.`);
    }
    const listrikPerBulan = int(l.tambahan_listrik);
    const jumlahDenda = int(input.jumlahDenda);
    const dendaPerUnit = int(input.dendaPerUnit);
    const totalSewa = hargaSewa * bulan;
    const totalListrik = listrikPerBulan * bulan;
    const totalDenda = dendaPerUnit * jumlahDenda;
    subtotal = totalSewa + totalListrik + totalDenda;
    if (diskon > subtotal) throw new Error('Diskon tidak boleh melebihi subtotal.');
    const grandTotal = subtotal - diskon + pajak;
    if (grandTotal <= 0) throw new Error('Grand total tidak valid (harus lebih dari 0).');

    if (l.id_penghuni) {
      const bentrok = await turso().execute({
        sql: `SELECT id_payment, periode_awal, periode_akhir FROM payment
              WHERE id_penghuni = ? AND id_payment <> ? AND status <> 'Cancelled' AND periode_akhir IS NOT NULL
                AND periode_awal < ? AND periode_akhir > ? LIMIT 1`,
        args: [l.id_penghuni, noInv, periodeAkhir, periodeAwal]
      });
      const b = bentrok.rows[0];
      if (b) throw new Error(`Periode tumpang tindih dengan pembayaran ${b.id_payment} (${fmtTanggal(b.periode_awal)} s.d. ${fmtTanggal(b.periode_akhir)}).`);
    }

    setSql = `email = ?, tanggal_pembayaran = ?, periode_awal = ?, periode_akhir = ?, jumlah_bulan = ?, jumlah_denda = ?,
              harga_sewa = ?, denda = ?, total_sewa = ?, total_listrik = ?, total_denda = ?, diskon = ?, pajak = ?,
              subtotal = ?, grand_total = ?`;
    setArgs = [email, tanggalBayar, periodeAwal, periodeAkhir, bulan, jumlahDenda, hargaSewa, dendaPerUnit, totalSewa,
      totalListrik, totalDenda, diskon, pajak, subtotal, grandTotal];
    barisBaru = (kodeKas) =>
      barisJurnalSewa({
        kodeKas, nama: l.nama, noKamar: l.no_kamar, tanggalBayar, periodeAwal: periodeAwal!, jumlahBulan: bulan,
        totalSewa, totalListrik, totalDenda, diskon, pajak, grandTotal
      });
  } else {
    const d = lama as NonNullable<Awaited<ReturnType<typeof getInvoiceDp>>>;
    subtotal = int(d.subtotal ?? d.harga_kamar);
    if (diskon > subtotal) throw new Error('Diskon tidak boleh melebihi subtotal.');
    const grandTotal = subtotal - diskon + pajak;
    if (grandTotal <= 0) throw new Error('Grand total tidak valid (harus lebih dari 0).');
    setSql = 'email = ?, tanggal_pembayaran = ?, diskon = ?, pajak = ?, grand_total = ?';
    setArgs = [email, tanggalBayar, diskon, pajak, grandTotal];
    barisBaru = (kodeKas) => barisJurnalDp({ kodeKas, nama: d.nama, noKamar: d.no_kamar, tanggalBayar, subtotal, diskon, pajak });
  }
  const grandTotalBaru = Number(setArgs[setArgs.length - 1]);

  // ---- jurnal lama (wajib ketemu) ----
  const { ids: idJurnalLama, kodeKas: kodeKasLama } = await jurnalInvoice(c, lama);
  let kodeKasBaru = kodeKasLama;
  if (input.akunKasBank?.trim()) {
    const k = await kodeAkunKas(input.akunKasBank);
    if (!k) throw new Error(`Akun "${input.akunKasBank}" tidak ada di COA grup Kas & Bank.`);
    kodeKasBaru = k;
  }

  const sudah = await turso().execute({
    sql: `SELECT (SELECT COUNT(*) FROM invoice_sewa WHERE koreksi_dari IS NOT NULL AND no_inv LIKE ?)
              + (SELECT COUNT(*) FROM invoice_dp WHERE koreksi_dari IS NOT NULL AND no_inv LIKE ?) AS n`,
    args: [`${noInv.replace(/-K\d+$/, '')}-K%`, `${noInv.replace(/-K\d+$/, '')}-K%`]
  });
  const noInvBaru = nomorKoreksi(noInv, Number(sudah.rows[0]?.n ?? 0));

  await dalamTransaksi(async (tx) => {
    await balikBarisJurnal(tx, idJurnalLama, `Koreksi ${noInv} -> ${noInvBaru}`);
    await tandaiVoid(tx, c, `Dikoreksi menjadi ${noInvBaru}`, input.oleh);

    // Invoice baru = salinan invoice lama (kolom identitas/tarif) + nilai koreksi.
    const kolom =
      jenis === 'Sewa'
        ? 'id_penghuni, nama, email, tanggal_pembayaran, periode_awal, periode_akhir, no_kamar, jumlah_bulan, jumlah_denda, harga_sewa, tambahan_listrik, denda, total_sewa, total_listrik, total_denda, diskon, pajak, subtotal, grand_total, tipe_kamar'
        : 'id_penghuni, nama, email, tanggal_pembayaran, no_kamar, tipe_kamar, jumlah, harga_kamar, subtotal, pajak, diskon, grand_total';
    const ins = await tx.execute({
      sql: `INSERT INTO ${c.tabel} (no_inv, ${kolom}, checked, koreksi_dari)
            SELECT ?, ${kolom}, 0, ? FROM ${c.tabel} WHERE id = ?`,
      args: [noInvBaru, noInv, c.idRow]
    });
    const idBaru = Number(ins.lastInsertRowid);
    await tx.execute({ sql: `UPDATE ${c.tabel} SET ${setSql} WHERE id = ?`, args: [...setArgs, idBaru] });

    const adaPayment = (
      await tx.execute({ sql: `SELECT 1 FROM payment WHERE ${c.kolomPayment} = ? LIMIT 1`, args: [c.idRow] })
    ).rows.length > 0;
    if (adaPayment) {
      await tx.execute({
        sql: `INSERT INTO payment (id_payment, id_penghuni, invoice_dp_id, invoice_sewa_id, periode_awal, periode_akhir, amount, payment_date, payment_method, status, notes)
              SELECT ?, id_penghuni, ?, ?, ?, ?, ?, ?, payment_method, 'Paid', ? FROM payment WHERE ${c.kolomPayment} = ? ORDER BY rowid DESC LIMIT 1`,
        args: [
          noInvBaru,
          jenis === 'DP' ? idBaru : null,
          jenis === 'Sewa' ? idBaru : null,
          jenis === 'Sewa' ? periodeAwal : tanggalBayar,
          periodeAkhir,
          grandTotalBaru,
          tanggalBayar,
          `Koreksi dari ${noInv}`,
          c.idRow
        ]
      });
    }

    for (const b of barisBaru(kodeKasBaru, noInvBaru)) {
      await tx.execute({
        sql: `INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori, grup_id, koreksi_dari)
              VALUES (?,?,?,?,?,?,?,?)`,
        args: [b.tanggal, b.debit, b.kredit, b.nominal, b.keterangan, b.kategori, noInvBaru, noInv]
      });
    }
  });

  const sesudah = jenis === 'Sewa' ? await getInvoiceSewa(noInvBaru) : await getInvoiceDp(noInvBaru);
  return { jenis, sebelum: lama, sesudah, noInvBaru };
}

type BarisCari = Pick<BarisJurnal, 'tanggal' | 'keterangan' | 'nominal'>;

function bangunLamaSewa(l: any, lama = false): BarisCari[] {
  return barisJurnalSewa({
    kodeKas: 0, nama: l.nama, noKamar: l.no_kamar, tanggalBayar: String(l.tanggal_pembayaran), periodeAwal: String(l.periode_awal),
    jumlahBulan: int(l.jumlah_bulan) || 1, totalSewa: int(l.total_sewa), totalListrik: int(l.total_listrik),
    totalDenda: int(l.total_denda), diskon: int(l.diskon), pajak: int(l.pajak), grandTotal: int(l.grand_total), lama
  });
}

function bangunLamaDp(d: any): BarisCari[] {
  return barisJurnalDp({
    kodeKas: 0, nama: d.nama, noKamar: d.no_kamar, tanggalBayar: String(d.tanggal_pembayaran),
    subtotal: int(d.subtotal ?? d.grand_total), diskon: int(d.diskon), pajak: int(d.pajak)
  });
}

/** Satu baris DB per baris lama (tanpa memakai id yang sama dua kali, hanya baris aktif); null kalau ada yang tidak ketemu. */
async function cocokkanJurnal(lama: BarisCari[]): Promise<{ ids: number[]; kodeKas: number } | null> {
  const ids: number[] = [];
  let kodeKas = 0;
  for (let i = 0; i < lama.length; i++) {
    const b = lama[i];
    const pakai = ids.length ? ` AND id NOT IN (${ids.map(() => '?').join(',')})` : '';
    const r = await turso().execute({
      sql: `SELECT id, akun_debit_kode FROM jurnal_transaksi
            WHERE tanggal = ? AND keterangan = ? AND nominal = ? AND void_dari IS NULL AND dibalik_oleh IS NULL${pakai}
            ORDER BY id LIMIT 1`,
      args: [b.tanggal, b.keterangan, b.nominal, ...ids]
    });
    if (!r.rows[0]) return null;
    ids.push(Number(r.rows[0].id));
    if (i === 0) kodeKas = Number(r.rows[0].akun_debit_kode);
  }
  return { ids, kodeKas };
}
