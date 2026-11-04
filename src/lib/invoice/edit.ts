import { turso } from '../core/turso';
import { withLock } from '../core/redis';
import { getInvoiceSewaMaster } from '../master';
import { barisJurnalDp, barisJurnalSewa, kodeAkunKas, type BarisJurnal } from '../jurnal';
import { addMonthsSewa, toISO } from '../modules/handlers/pembayaran-sewa-preview';
import { parseDateISO } from '../core/validate';
import { getInvoiceDp, getInvoiceSewa } from './data';

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

export type HasilEditInvoice = { jenis: 'DP' | 'Sewa'; sebelum: unknown; sesudah: unknown; peringatan?: string };

const int = (v: unknown) => Math.round(Number(v ?? 0)) || 0;

/**
 * Edit invoice + payment + jurnal dalam satu transaksi.
 *
 * jurnal_transaksi tidak punya tautan ke invoice, jadi baris lama dicari dengan
 * membangun ULANG baris yang seharusnya dibuat dari data invoice SEBELUM diedit
 * (fungsi yang sama dengan saat input), lalu dicocokkan lewat tanggal+keterangan+
 * nominal. Kalau ada satu saja yang tidak ketemu (mis. jurnal bikinan manual),
 * jurnal tidak disentuh dan admin diberi peringatan — lebih baik jurnal lama
 * utuh daripada menimpa baris yang salah.
 *
 * No. invoice sengaja tetap walau periode berubah: nomor itu sudah dikirim ke
 * penghuni dan dipakai sebagai id_payment.
 */
export function editInvoice(input: InputEditInvoice): Promise<HasilEditInvoice> {
  return withLock(`edit-inv:${input.noInv}`, 20, () => jalankan(input));
}

async function jalankan(input: InputEditInvoice): Promise<HasilEditInvoice> {
  const { noInv, jenis } = input;
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Email tidak valid: "${email}".`);
  const tanggalBayar = parseDateISO(input.tanggalBayar);
  const diskon = int(input.diskon);
  const pajak = int(input.pajak);
  if (diskon < 0 || pajak < 0) throw new Error('Diskon dan pajak tidak boleh negatif.');

  const lama = jenis === 'Sewa' ? await getInvoiceSewa(noInv) : await getInvoiceDp(noInv);
  if (!lama) throw new Error(`Invoice ${noInv} tidak ditemukan.`);
  const tabel = jenis === 'Sewa' ? 'invoice_sewa' : 'invoice_dp';
  const idRow = Number(
    (await turso().execute({ sql: `SELECT id FROM ${tabel} WHERE no_inv = ? ORDER BY id DESC LIMIT 1`, args: [noInv] })).rows[0].id
  );

  // ---- hitung nilai baru ----
  let subtotal: number;
  let setSql: string;
  let setArgs: (string | number | null)[];
  let periodeAwal: string | null = null;
  let periodeAkhir: string | null = null;
  let barisBaru: (kodeKas: number) => BarisJurnal[];

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
              WHERE id_penghuni = ? AND id_payment <> ? AND periode_akhir IS NOT NULL
                AND periode_awal < ? AND periode_akhir > ? LIMIT 1`,
        args: [l.id_penghuni, noInv, periodeAkhir, periodeAwal]
      });
      const b = bentrok.rows[0];
      if (b) throw new Error(`Periode tumpang tindih dengan pembayaran ${b.id_payment} (${b.periode_awal} s.d. ${b.periode_akhir}).`);
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

  // ---- cari jurnal lama dari data invoice sebelum diedit ----
  const kolomPayment = jenis === 'Sewa' ? 'invoice_sewa_id' : 'invoice_dp_id';
  const adaPayment =
    (await turso().execute({ sql: `SELECT 1 FROM payment WHERE ${kolomPayment} = ? LIMIT 1`, args: [idRow] })).rows.length > 0;

  let peringatan: string | undefined;
  let idJurnalLama: number[] | null = null;
  let kodeKasLama = 0;
  if (!adaPayment) {
    peringatan = 'Invoice ini belum punya catatan pembayaran — jurnal tidak diubah.';
  } else {
    const barisLama = jenis === 'Sewa' ? bangunLamaSewa(lama as any) : bangunLamaDp(lama as any);
    const cari = await cocokkanJurnal(barisLama);
    if (cari) {
      idJurnalLama = cari.ids;
      kodeKasLama = cari.kodeKas;
    } else {
      peringatan = 'Jurnal lama tidak dapat dicocokkan otomatis (mungkin diinput manual) — jurnal TIDAK diubah, koreksi manual.';
    }
  }

  let kodeKasBaru = kodeKasLama;
  if (idJurnalLama && input.akunKasBank?.trim()) {
    const k = await kodeAkunKas(input.akunKasBank);
    if (!k) throw new Error(`Akun "${input.akunKasBank}" tidak ada di COA grup Kas & Bank.`);
    kodeKasBaru = k;
  }

  // ---- tulis atomik ----
  const tx = await turso().transaction('write');
  try {
    await tx.execute({ sql: `UPDATE ${tabel} SET ${setSql} WHERE id = ?`, args: [...setArgs, idRow] });
    await tx.execute({
      sql: `UPDATE payment SET amount = ?, payment_date = ?, periode_awal = ?, periode_akhir = ?
            WHERE ${kolomPayment} = ?`,
      args: [grandTotalBaru, tanggalBayar, jenis === 'Sewa' ? periodeAwal : tanggalBayar, periodeAkhir, idRow]
    });

    if (idJurnalLama) {
      const baru = barisBaru(kodeKasBaru);
      const sisa = baru.length - idJurnalLama.length;
      for (let i = 0; i < Math.min(baru.length, idJurnalLama.length); i++) {
        const b = baru[i];
        await tx.execute({
          sql: `UPDATE jurnal_transaksi SET tanggal = ?, akun_debit_kode = ?, akun_kredit_kode = ?, nominal = ?,
                       keterangan = ?, kategori = ? WHERE id = ?`,
          args: [b.tanggal, b.debit, b.kredit, b.nominal, b.keterangan, b.kategori, idJurnalLama[i]]
        });
      }
      if (sisa > 0) {
        for (const b of baru.slice(idJurnalLama.length)) {
          await tx.execute({
            sql: `INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori)
                  VALUES (?,?,?,?,?,?)`,
            args: [b.tanggal, b.debit, b.kredit, b.nominal, b.keterangan, b.kategori]
          });
        }
      } else if (sisa < 0) {
        for (const id of idJurnalLama.slice(baru.length)) {
          await tx.execute({ sql: 'DELETE FROM jurnal_transaksi WHERE id = ?', args: [id] });
        }
      }
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  } finally {
    tx.close();
  }

  const sesudah = jenis === 'Sewa' ? await getInvoiceSewa(noInv) : await getInvoiceDp(noInv);
  return { jenis, sebelum: lama, sesudah, peringatan };
}

type BarisCari = Pick<BarisJurnal, 'tanggal' | 'keterangan' | 'nominal'>;

function bangunLamaSewa(l: any): BarisCari[] {
  return barisJurnalSewa({
    kodeKas: 0, nama: l.nama, noKamar: l.no_kamar, tanggalBayar: String(l.tanggal_pembayaran), periodeAwal: String(l.periode_awal),
    jumlahBulan: int(l.jumlah_bulan) || 1, totalSewa: int(l.total_sewa), totalListrik: int(l.total_listrik),
    totalDenda: int(l.total_denda), diskon: int(l.diskon), pajak: int(l.pajak), grandTotal: int(l.grand_total)
  });
}

function bangunLamaDp(d: any): BarisCari[] {
  return barisJurnalDp({
    kodeKas: 0, nama: d.nama, noKamar: d.no_kamar, tanggalBayar: String(d.tanggal_pembayaran),
    subtotal: int(d.subtotal ?? d.grand_total), diskon: int(d.diskon), pajak: int(d.pajak)
  });
}

/** Satu baris DB per baris lama (tanpa memakai id yang sama dua kali); null kalau ada yang tidak ketemu. */
async function cocokkanJurnal(lama: BarisCari[]): Promise<{ ids: number[]; kodeKas: number } | null> {
  const ids: number[] = [];
  let kodeKas = 0;
  for (let i = 0; i < lama.length; i++) {
    const b = lama[i];
    const pakai = ids.length ? ` AND id NOT IN (${ids.map(() => '?').join(',')})` : '';
    const r = await turso().execute({
      sql: `SELECT id, akun_debit_kode FROM jurnal_transaksi WHERE tanggal = ? AND keterangan = ? AND nominal = ?${pakai} ORDER BY id LIMIT 1`,
      args: [b.tanggal, b.keterangan, b.nominal, ...ids]
    });
    if (!r.rows[0]) return null;
    ids.push(Number(r.rows[0].id));
    if (i === 0) kodeKas = Number(r.rows[0].akun_debit_kode);
  }
  return { ids, kodeKas };
}
