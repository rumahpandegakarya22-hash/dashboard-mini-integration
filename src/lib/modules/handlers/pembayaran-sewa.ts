import { appendRow, assertHeaders, readTable } from '../../sheets';
import { withLock } from '../../redis';
import { turso } from '../../turso';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';
import { previewPembayaranSewa } from './pembayaran-sewa-preview';
import { saveLampiran, resolveOccupancyId } from './helpers';
import type { SubmitContext, SubmitHandler } from '../types';

// Kolom A:F sheet "Input Sewa Dimuka" (Log Input Transaksi). Jurnal digenerate Apps Script "Kost Tools"
// dari sheet ini — TIDAK menulis langsung ke sheet Transaksi (PRD §6/§8 Modul 2). Header DIKONFIRMASI
// live 8 Jul (bukan tebakan lagi) — perhatikan "Unit / Penyewa" pakai spasi di sekitar garis miring.
const HEADER_RANGE = "'Input Sewa Dimuka'!A1:F1";
const EXPECTED_HEADERS = ['Tanggal Mulai', 'Unit / Penyewa', 'Nominal per Bulan', 'Jumlah Bulan', 'Akun Kas/Bank', 'Sudah Digenerate?'];

const APPS_SCRIPT_URL: Record<string, string | undefined> = {
  DP: process.env.APPS_SCRIPT_INVOICE_DP_URL,
  Sewa: process.env.APPS_SCRIPT_INVOICE_SEWA_URL
};

function addMonths(iso: string, months: number): Date {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Catat invoice + payment ke Turso — invoice_dp/invoice_sewa dipilih dari jenisPembayaran,
 * `payment` di-link ke baris itu via invoice_dp_id/invoice_sewa_id (bukan cuma id_penghuni).
 * Pakai `raw` yang SAMA dgn perhitungan Sheets/Apps Script di atas (bukan hitung ulang).
 * Best-effort: Sheets + email invoice tetap sumber utama & sudah tercatat sebelum ini dipanggil;
 * gagal di sini jadi warning, TIDAK membatalkan pencatatan pembayaran yang sudah sukses.
 */
async function saveInvoiceAndPaymentTurso(
  raw: Record<string, any>,
  jenisPembayaran: 'DP' | 'Sewa',
  tanggalBayar: string,
  akunKasBank: string,
  nominal: number,
  ctx: SubmitContext
): Promise<string | undefined> {
  try {
    const occupancyId = await resolveOccupancyId(String(raw.noKamar));
    if (!occupancyId) {
      return `Kamar ${raw.noKamar} tidak ditemukan sebagai penghuni aktif di occupancy_history — invoice/payment TIDAK dicatat ke database, cek manual.`;
    }

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

      const idPayment = `PAY-${tanggalBayar.replace(/-/g, '')}-${ctx.requestId.slice(0, 8)}`;
      const billingPeriod = jenisPembayaran === 'Sewa' ? `${raw.periodeAwal} s.d. ${raw.periodeAkhir}` : 'DP';

      await tx.execute({
        sql: `INSERT INTO payment
              (id_payment, id_penghuni, invoice_dp_id, invoice_sewa_id, no_invoice, billing_period, amount, payment_date, status, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Paid', ?)`,
        args: [
          idPayment,
          occupancyId,
          jenisPembayaran === 'DP' ? invoiceId : null,
          jenisPembayaran === 'Sewa' ? invoiceId : null,
          raw.noInv,
          billingPeriod,
          nominal,
          tanggalBayar,
          // payment_method TIDAK diisi: akunKasBank ("BCA"/"Cash"/"GoPay" dst) beda taksonomi dari
          // CHECK constraint payment.payment_method ('Transfer'/'Qris'/'Cash') — dicatat di notes saja
          // drpd dipaksa map yang berisiko salah kategori.
          `Akun kas/bank: ${akunKasBank}`
        ]
      });

      await tx.commit();
      return undefined;
    } finally {
      tx.close();
    }
  } catch (e: any) {
    console.error('[pembayaran-sewa] gagal simpan invoice/payment ke Turso:', e?.message);
    return `Pembayaran tercatat di ledger, tapi gagal disimpan ke database invoice/payment — cek manual: ${e?.message || 'unknown error'}`;
  }
}

export const submitPembayaranSewa: SubmitHandler = async (values, ctx) => {
  const penghuni = required(values.penghuni, 'Penghuni'); // format baku "KTD-x — Nama"
  const jenisPembayaran = required(values.jenisPembayaran, 'Jenis Pembayaran');
  if (jenisPembayaran !== 'DP' && jenisPembayaran !== 'Sewa') throw new Error('Jenis Pembayaran tidak valid.');
  const tanggalBayar = parseDateISO(String(values.tanggalBayar ?? ''));
  // Lama Sewa cuma relevan utk jenis Sewa (field disembunyikan showIf utk DP) — DP dicatat 1 bulan di ledger.
  const jumlahBulan = jenisPembayaran === 'Sewa' ? parseInt(String(values.jumlahBulan ?? ''), 10) : 1;
  if (jenisPembayaran === 'Sewa' && (!jumlahBulan || jumlahBulan < 1)) throw new Error('Lama Sewa tidak valid.');
  const akunKasBank = required(values.akunKasBank, 'Akun Kas/Bank');

  // Nominal TIDAK lagi diketik manual — otomatis = Grand Total dari kriteria harga di sheet Invoice
  // Generator (sama persis dgn yg sudah dilihat admin di layar Preview sebelum konfirmasi). Dihitung
  // SEKALI di sini dan dipakai ulang di bawah utk payload Apps Script — hindari hitung dua kali/beda.
  const preview = await previewPembayaranSewa(values, ctx);
  const raw = preview.raw as Record<string, any>;
  const nominal = Math.round(raw.grandTotal);

  return withLock(`penghuni:${penghuni}`, 15, async () => {
    await assertHeaders(SHEETS.LOG_INPUT_TRANSAKSI, HEADER_RANGE, EXPECTED_HEADERS);

    // Anti bayar 2× untuk penghuni & periode yang sama (overlap tanggal mulai..+jumlah bulan).
    const existing = await readTable(SHEETS.LOG_INPUT_TRANSAKSI, "'Input Sewa Dimuka'!A:F");
    const newStart = new Date(`${tanggalBayar}T00:00:00`);
    const newEnd = addMonths(tanggalBayar, jumlahBulan);
    for (const r of existing) {
      if ((r['Unit / Penyewa'] || '').trim() !== penghuni) continue;
      const mulai = (r['Tanggal Mulai'] || '').trim();
      const bulan = parseInt(r['Jumlah Bulan'] || '0', 10);
      if (!mulai || !bulan) continue;
      const exStart = new Date(`${mulai}T00:00:00`);
      if (isNaN(exStart.getTime())) continue;
      const exEnd = addMonths(mulai, bulan);
      if (newStart.getTime() < exEnd.getTime() && exStart.getTime() < newEnd.getTime()) {
        throw new Error(`Sudah ada pembayaran untuk ${penghuni} pada periode yang tumpang tindih.`);
      }
    }

    const nominalPerBulan = Math.round(nominal / jumlahBulan);
    const row = await appendRow(SHEETS.LOG_INPUT_TRANSAKSI, "'Input Sewa Dimuka'!A:F", [
      tanggalBayar,
      penghuni,
      nominalPerBulan,
      jumlahBulan,
      akunKasBank,
      'Belum'
    ]);

    // Trigger Apps Script invoice — best-effort, gagal tidak membatalkan pencatatan pembayaran (fallback PRD §6 Modul 2).
    // Pakai `raw` yg SAMA dgn perhitungan nominal di atas (bukan hitung ulang) — payload yg dikirim ke
    // Apps Script konsisten persis dgn yg ditampilkan ke user sebelum submit.
    const scriptUrl = APPS_SCRIPT_URL[jenisPembayaran];
    const token = process.env.APPS_SCRIPT_TOKEN;
    let invoiceStatus = 'Belum dipicu (URL/token Apps Script belum diisi di env) — generate manual di Generator Tagihan.';
    if (scriptUrl && token) {
      try {
        const input =
          jenisPembayaran === 'Sewa'
            ? {
                nama: raw.nama,
                email: raw.email,
                noKamar: raw.noKamar,
                tipe: raw.tipe,
                lamaSewa: raw.lamaSewa,
                tglPembayaran: raw.tglPembayaran,
                periodeAwal: raw.periodeAwal,
                dendaPerUnit: raw.dendaPerUnit,
                jumlahDenda: raw.jumlahDenda,
                pajak: raw.pajak,
                diskon: raw.diskon
              }
            : {
                nama: raw.nama,
                noKamar: raw.noKamar,
                tglPembayaran: raw.tglPembayaran,
                pajak: raw.pajak,
                diskon: raw.diskon
              };
        const res = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, mode: 'send', input })
        });
        const json = await res.json().catch(() => ({}) as any);
        invoiceStatus =
          res.ok && json.success
            ? `Invoice ${json.noInv || ''} terkirim ke ${json.email || raw.email || '(email tidak diketahui)'}.`
            : `Gagal mengirim invoice: ${json.error || `HTTP ${res.status}`} — generate manual di Generator Tagihan.`;
      } catch (e: any) {
        invoiceStatus = `Gagal memicu invoice: ${e?.message || 'unknown error'} — generate manual di Generator Tagihan.`;
      }
    }

    const lampiranWarning = await saveLampiran(values, ctx, `Bukti Pembayaran ${jenisPembayaran} — ${penghuni} (${tanggalBayar})`, 'Admin');
    const tursoWarning = await saveInvoiceAndPaymentTurso(raw, jenisPembayaran, tanggalBayar, akunKasBank, nominal, ctx);

    return {
      target: 'Log Input Transaksi → Input Sewa Dimuka',
      row,
      data: { penghuni, jenisPembayaran, tanggalBayar, nominal, jumlahBulan, akunKasBank, invoiceStatus },
      warning: [lampiranWarning, tursoWarning].filter(Boolean).join(' ') || undefined
    };
  });
};
