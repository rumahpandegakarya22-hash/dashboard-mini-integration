import { withLock } from '../../core/redis';
import { turso } from '../../core/turso';
import { getTenantByLabel } from '../../master';
import { parseDateISO, required } from '../../core/validate';
import { previewPembayaranSewa } from './pembayaran-sewa-preview';
import { saveLampiran, resolveOccupancyId } from './helpers';
import { kirimInvoice } from '../../invoice';
import { barisJurnalDp, barisJurnalSewa, kodeAkunKas, type BarisJurnal } from '../../jurnal';
import type { AutoFillHandler, SubmitHandler } from '../types';

/* ==========================================================================
   SEPENUHNYA DI TURSO sejak 4 Agustus 2026 — Google Sheets sudah dilepas.

   Sebelumnya modul ini menulis ke sheet 'Input Sewa Dimuka', yang dibaca Apps
   Script "Kost Tools" untuk menghasilkan jurnal. Dua ketergantungan itu hilang
   sekaligus: invoice dikirim app sendiri (src/lib/invoice/), dan jurnal ditulis
   langsung ke tabel jurnal_transaksi (src/lib/jurnal.ts) dengan pola akun yang
   sama persis dengan jurnal lama.

   Yang perlu diingat soal bentuk datanya:
     - payment.id_payment berisi NOMOR INVOICE (mis. "INV/11/TDU/07/2026"),
       bukan id terpisah — dipertahankan supaya sebanding dengan 45 baris lama.
     - payment punya CHECK: (invoice_dp_id IS NOT NULL) + (invoice_sewa_id IS
       NOT NULL) = 1, jadi tiap payment wajib tertaut tepat satu invoice.
     - payment.payment_method dibatasi ('Transfer','Qris','Cash') sedangkan form
       mengirim nama akun kas/bank → sengaja dikosongkan, dicatat di notes.
   ========================================================================== */

/**
 * Catat invoice + payment + jurnal ke Turso dalam SATU transaksi.
 *
 * Sejak Sheets dilepas, ini satu-satunya tempat pembayaran tercatat — jadi
 * kegagalan di sini MELEMPAR error dan membatalkan submit, bukan lagi sekadar
 * warning seperti waktu sheet masih jadi sumber utama. Lebih baik admin
 * mengulang input daripada uang masuk tanpa catatan.
 *
 * Jurnal ikut di transaksi yang sama supaya tidak ada pembayaran tanpa jurnal
 * atau sebaliknya. Kalau aturan jurnalnya tidak bisa dipastikan (akun kas tidak
 * dikenal, atau ada diskon/pajak), jurnal DILEWATI dan dikembalikan sebagai
 * peringatan — invoice & payment tetap tersimpan.
 */
async function simpanPembayaran(
  raw: Record<string, any>,
  jenisPembayaran: 'DP' | 'Sewa',
  tanggalBayar: string,
  akunKasBank: string,
  nominal: number
): Promise<{ peringatanJurnal?: string }> {
  const occupancyId = await resolveOccupancyId(String(raw.noKamar));
  if (!occupancyId) {
    throw new Error(
      `Kamar ${raw.noKamar} tidak ditemukan sebagai penghuni aktif di occupancy_history — pembayaran tidak dicatat. Periksa data check-in penghuni dulu.`
    );
  }

  const { baris, peringatanJurnal } = await siapkanJurnal(raw, jenisPembayaran, tanggalBayar, akunKasBank);

  const tx = await turso().transaction('write');
  try {
      const invoiceRes =
        jenisPembayaran === 'Sewa'
          ? await tx.execute({
              sql: `INSERT INTO invoice_sewa
                    (no_inv, id_penghuni, nama, email, tanggal_pembayaran, periode_awal, periode_akhir, no_kamar,
                     jumlah_bulan, jumlah_denda, harga_sewa, tambahan_listrik, denda, total_sewa, total_listrik,
                     total_denda, diskon, pajak, subtotal, grand_total, tipe_kamar, checked)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
              args: [
                raw.noInv, occupancyId, raw.nama, raw.email || null, tanggalBayar, raw.periodeAwal, raw.periodeAkhir,
                String(raw.noKamar), raw.lamaSewa, raw.jumlahDenda, raw.sewaPerBulan, raw.listrikPerBulan,
                raw.dendaPerUnit, raw.totalSewa, raw.totalListrik, raw.totalDenda, raw.diskon, raw.pajak,
                raw.subtotal, raw.grandTotal, raw.tipe
              ]
            })
          : await tx.execute({
              sql: `INSERT INTO invoice_dp
                    (no_inv, id_penghuni, nama, email, tanggal_pembayaran, no_kamar, tipe_kamar, jumlah,
                     harga_kamar, subtotal, pajak, diskon, grand_total, checked)
                    VALUES (?,?,?,?,?,?,?,1,?,?,?,?,?,0)`,
              args: [
                raw.noInv, occupancyId, raw.nama, raw.email || null, tanggalBayar, String(raw.noKamar), raw.tipe,
                raw.hargaKamar, raw.subtotal, raw.pajak, raw.diskon, raw.grandTotal
              ]
            });
      const invoiceId = invoiceRes.lastInsertRowid;

      // periode_awal/periode_akhir Sewa dari invoice; DP cuma 1 tanggal (periode_akhir NULL).
      const periodeAwal = jenisPembayaran === 'Sewa' ? raw.periodeAwal : tanggalBayar;
      const periodeAkhir = jenisPembayaran === 'Sewa' ? raw.periodeAkhir : null;

      await tx.execute({
        sql: `INSERT INTO payment
              (id_payment, id_penghuni, invoice_dp_id, invoice_sewa_id, periode_awal, periode_akhir, amount, payment_date, status, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Paid', ?)`,
        args: [
          raw.noInv,
          occupancyId,
          jenisPembayaran === 'DP' ? invoiceId : null,
          jenisPembayaran === 'Sewa' ? invoiceId : null,
          periodeAwal,
          periodeAkhir,
          nominal,
          tanggalBayar,
          // payment_method TIDAK diisi: akunKasBank ("BCA"/"Cash"/"GoPay" dst) beda taksonomi dari
          // CHECK constraint payment.payment_method ('Transfer'/'Qris'/'Cash') — dicatat di notes saja
          // drpd dipaksa map yang berisiko salah kategori.
          `Akun kas/bank: ${akunKasBank}`
        ]
      });

      for (const b of baris) {
        await tx.execute({
          sql: `INSERT INTO jurnal_transaksi (tanggal, akun_debit_kode, akun_kredit_kode, nominal, keterangan, kategori)
                VALUES (?,?,?,?,?,?)`,
          args: [b.tanggal, b.debit, b.kredit, b.nominal, b.keterangan, b.kategori]
        });
      }

      await tx.commit();
      return { peringatanJurnal };
    } finally {
      tx.close();
    }
}

/**
 * Susun baris jurnal, atau lewati dengan alasan yang jelas kalau aturannya tidak
 * bisa dipastikan. Sengaja TIDAK menebak: jurnal salah lebih merugikan daripada
 * jurnal kosong yang diinput manual.
 */
async function siapkanJurnal(
  raw: Record<string, any>,
  jenisPembayaran: 'DP' | 'Sewa',
  tanggalBayar: string,
  akunKasBank: string
): Promise<{ baris: BarisJurnal[]; peringatanJurnal?: string }> {
  const kodeKas = await kodeAkunKas(akunKasBank);
  if (!kodeKas) {
    return {
      baris: [],
      peringatanJurnal: `Jurnal TIDAK dibuat: akun "${akunKasBank}" tidak ada di COA grup Kas & Bank. Input jurnal manual.`
    };
  }

  // Diskon & pajak belum pernah terjadi di data produksi, jadi pembagiannya ke
  // baris pengakuan belum punya aturan yang teruji. Daripada menebak dan
  // menyisakan selisih di akun 2105, jurnalnya dilewati dan diberitahukan.
  if (Number(raw.diskon) > 0 || Number(raw.pajak) > 0) {
    return {
      baris: [],
      peringatanJurnal: 'Jurnal TIDAK dibuat otomatis karena ada diskon/pajak — aturan pembagiannya belum ditetapkan. Input jurnal manual.'
    };
  }

  const umum = { kodeKas, nama: String(raw.nama), noKamar: String(raw.noKamar), tanggalBayar, grandTotal: Math.round(raw.grandTotal) };

  if (jenisPembayaran === 'DP') return { baris: barisJurnalDp(umum) };

  return {
    baris: barisJurnalSewa({
      ...umum,
      periodeAwal: String(raw.periodeAwal),
      jumlahBulan: Number(raw.lamaSewa),
      totalSewa: Math.round(raw.totalSewa),
      totalListrik: Math.round(raw.totalListrik),
      totalDenda: Math.round(raw.totalDenda)
    })
  };
}

/**
 * Anti bayar 2× untuk periode yang tumpang tindih. Dulu membaca sheet 'Input
 * Sewa Dimuka'; sekarang dari tabel `payment` yang memang sudah menyimpan
 * periode_awal & periode_akhir — lebih akurat karena membandingkan periode
 * sewa sungguhan, bukan tanggal bayar + jumlah bulan.
 */
async function cekPeriodeTumpangTindih(occupancyId: string, periodeAwal: string, periodeAkhir: string): Promise<void> {
  const res = await turso().execute({
    sql: `SELECT id_payment, periode_awal, periode_akhir FROM payment
          WHERE id_penghuni = ? AND periode_akhir IS NOT NULL
            AND periode_awal < ? AND periode_akhir > ?
          LIMIT 1`,
    args: [occupancyId, periodeAkhir, periodeAwal]
  });
  const b = res.rows[0];
  if (b) {
    throw new Error(
      `Sudah ada pembayaran ${b.id_payment} untuk periode ${b.periode_awal} s.d. ${b.periode_akhir} yang tumpang tindih dengan periode ini.`
    );
  }
}

/**
 * Auto-fill Periode Awal Sewa (Improvement v1.2 §1): tanggal pembayaran ≠ tanggal awal sewa —
 * periode baru mulai saat periode terakhir habis. Ambil MAX(periode_akhir) payment penghuni ini
 * dari Turso (id_penghuni via occupancy_history, aturan sama dgn tunggakan checkout) → tampilkan
 * otomatis di field periodeAwalSewa; admin tetap bisa koreksi manual.
 */
export const autoFillPembayaranSewa: AutoFillHandler = async (values) => {
  const penghuni = String(values.penghuni ?? '').trim();
  const jenis = String(values.jenisPembayaran ?? '').trim();
  if (!penghuni || jenis !== 'Sewa') return { fields: {} as Record<string, string> }; // DP tidak punya field periode

  const tenant = await getTenantByLabel(penghuni);
  if (!tenant) return { fields: {} as Record<string, string>, note: `Penghuni "${penghuni}" tidak ditemukan di Database Penghuni.` };

  try {
    const occupancyId = await resolveOccupancyId(tenant.kamar);
    if (!occupancyId) {
      return {
        fields: {} as Record<string, string>,
        note: `Kamar ${tenant.kamar} tidak ditemukan sebagai penghuni aktif di occupancy_history — isi Periode Awal Sewa manual.`
      };
    }
    const res = await turso().execute({
      sql: 'SELECT MAX(periode_akhir) mx FROM payment WHERE id_penghuni = ? AND periode_akhir IS NOT NULL',
      args: [occupancyId]
    });
    const lunasSampai = res.rows[0]?.mx ? String(res.rows[0].mx) : null;
    if (!lunasSampai) {
      return {
        fields: {} as Record<string, string>,
        note: `Belum ada riwayat periode sewa di database untuk ${occupancyId} — isi Periode Awal Sewa manual (mis. tanggal masuk).`
      };
    }
    return {
      fields: { periodeAwalSewa: lunasSampai },
      note: `Periode Awal Sewa diisi otomatis: sewa terakhir habis ${lunasSampai}. Cek ulang sebelum kirim.`
    };
  } catch (e: any) {
    console.error('[pembayaran-sewa] gagal baca periode terakhir:', e?.message);
    return { fields: {} as Record<string, string>, note: 'Gagal membaca riwayat sewa dari database — isi Periode Awal Sewa manual.' };
  }
};

export const submitPembayaranSewa: SubmitHandler = async (values, ctx) => {
  const penghuni = required(values.penghuni, 'Penghuni'); // format baku "KTD-x — Nama"
  const jenisPembayaran = required(values.jenisPembayaran, 'Jenis Pembayaran');
  if (jenisPembayaran !== 'DP' && jenisPembayaran !== 'Sewa') throw new Error('Jenis Pembayaran tidak valid.');
  const tanggalBayar = parseDateISO(String(values.tanggalBayar ?? ''));
  // Lama Sewa cuma relevan utk jenis Sewa (field disembunyikan showIf utk DP) — DP dicatat 1 bulan di ledger.
  const jumlahBulan = jenisPembayaran === 'Sewa' ? parseInt(String(values.jumlahBulan ?? ''), 10) : 1;
  if (jenisPembayaran === 'Sewa' && (!jumlahBulan || jumlahBulan < 1)) throw new Error('Lama Sewa tidak valid.');
  const akunKasBank = required(values.akunKasBank, 'Akun Kas/Bank');

  // Nominal TIDAK diketik manual — otomatis = Grand Total dari kriteria harga Invoice Generator
  // (sama persis dgn yg sudah dilihat admin di layar Preview sebelum konfirmasi). Dihitung SEKALI
  // di sini dan dipakai ulang di bawah — hindari hitung dua kali/beda.
  const preview = await previewPembayaranSewa(values, ctx);
  const raw = preview.raw as Record<string, any>;
  const nominal = Math.round(raw.grandTotal);

  return withLock(`penghuni:${penghuni}`, 15, async () => {
    if (jenisPembayaran === 'Sewa') {
      const occupancyId = await resolveOccupancyId(String(raw.noKamar));
      if (occupancyId) await cekPeriodeTumpangTindih(occupancyId, String(raw.periodeAwal), String(raw.periodeAkhir));
    }

    // Invoice + payment + jurnal sekali jalan; melempar error kalau gagal, karena
    // sejak Sheets dilepas tidak ada lagi catatan cadangan di tempat lain.
    const { peringatanJurnal } = await simpanPembayaran(raw, jenisPembayaran, tanggalBayar, akunKasBank, nominal);

    // Kirim invoice langsung dari app (render PDF + Gmail API) — best-effort, gagal
    // tidak membatalkan pencatatan pembayaran yang sudah tersimpan di atas.
    const invoiceStatus = (await kirimInvoice(raw.noInv, jenisPembayaran)).pesan;

    // ID Docs bukti bayar memakai nomor invoicenya, bukan kode DOC- baru — biar
    // berkas di Drive langsung tertaut ke invoice & payment dengan id yang sama.
    const idPenghuni = await resolveOccupancyId(String(raw.noKamar));
    const lampiranWarning = await saveLampiran(
      values,
      ctx,
      `Bukti Pembayaran ${jenisPembayaran} — ${penghuni} (${tanggalBayar})`,
      'Admin',
      idPenghuni ? { penamaan: { jenis: `Bukti Bayar ${jenisPembayaran}`, idDocs: raw.noInv, idPenghuni } } : undefined
    );

    return {
      target: 'Database → invoice, payment, jurnal_transaksi',
      data: { penghuni, jenisPembayaran, tanggalBayar, nominal, jumlahBulan, akunKasBank, invoiceStatus },
      warning: [lampiranWarning, peringatanJurnal].filter(Boolean).join(' ') || undefined
    };
  });
};
