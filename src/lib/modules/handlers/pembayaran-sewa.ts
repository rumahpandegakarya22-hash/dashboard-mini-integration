import { appendRow, assertHeaders, readTable } from '../../core/sheets';
import { withLock } from '../../core/redis';
import { turso } from '../../core/turso';
import { SHEETS } from '@/config/spreadsheets';
import { getTenantByLabel } from '../../master';
import { parseDateISO, required } from '../../core/validate';
import { previewPembayaranSewa } from './pembayaran-sewa-preview';
import { saveLampiran, resolveOccupancyId } from './helpers';
import type { AutoFillHandler, SubmitHandler } from '../types';

/* ==========================================================================
   SENGAJA MASIH MEMAKAI GOOGLE SHEETS — bukan terlewat dari migrasi.

   Ini satu-satunya modul Ops yang belum dipindah ke Turso pada Wave 3, karena
   pencatatan pembayaran adalah HILIR dari generator invoice Apps Script, yang
   keputusannya ditunda ("bahas nanti"). Buktinya ada di data produksi:

     - payment.id_payment berisi NOMOR INVOICE hasil Apps Script
       (mis. "INV/11/TDU/07/2026"), bukan id yang dibuat aplikasi ini.
     - Tabel payment punya CHECK:
         (invoice_dp_id IS NOT NULL) + (invoice_sewa_id IS NOT NULL) = 1
       jadi satu baris payment WAJIB tertaut tepat satu baris invoice. Semua 45
       baris produksi memenuhinya (29 DP + 16 Sewa).

   Artinya menulis payment ke Turso mengharuskan aplikasi ini lebih dulu
   membuat baris invoice_sewa/invoice_dp + nomor invoicenya — yaitu mengambil
   alih tugas Apps Script. Memaksakannya sekarang berisiko merusak catatan
   keuangan, jadi jalur Sheets dipertahankan APA ADANYA sampai nasib generator
   invoice diputuskan.

   Yang juga perlu diputuskan saat migrasi modul ini nanti:
     - payment.payment_method dibatasi ('Transfer','Qris','Cash'), sedangkan
       form mengirim nama akun kas/bank → butuh pemetaan.
     - payment.status dibatasi ('Pending','Paid',...), sedangkan sheet memakai
       'Belum'.
   ========================================================================== */

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
 * `payment.id_payment` = no_inv invoice-nya langsung (dipakai jg sbg "No Invoice" tampilan) —
 * TIDAK generate kode PAY-xxx sendiri.
 * Pakai `raw` yang SAMA dgn perhitungan Sheets/Apps Script di atas (bukan hitung ulang).
 * Best-effort: Sheets + email invoice tetap sumber utama & sudah tercatat sebelum ini dipanggil;
 * gagal di sini jadi warning, TIDAK membatalkan pencatatan pembayaran yang sudah sukses.
 */
async function saveInvoiceAndPaymentTurso(
  raw: Record<string, any>,
  jenisPembayaran: 'DP' | 'Sewa',
  tanggalBayar: string,
  akunKasBank: string,
  nominal: number
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

      await tx.commit();
      return undefined;
    } finally {
      tx.close();
    }
  } catch (e: any) {
    console.error('[pembayaran-sewa] gagal simpan invoice/payment ke Turso:', e?.message);
    return `Pembayaran tercatat di ledger, tapi gagal disimpan ke database invoice/payment — cek manual (kemungkinan No. Invoice "${raw.noInv}" sudah pernah dicatat sebelumnya): ${e?.message || 'unknown error'}`;
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

  // Nominal TIDAK lagi diketik manual — otomatis = Grand Total dari kriteria harga di sheet Invoice
  // Generator (sama persis dgn yg sudah dilihat admin di layar Preview sebelum konfirmasi). Dihitung
  // SEKALI di sini dan dipakai ulang di bawah utk payload Apps Script — hindari hitung dua kali/beda.
  const preview = await previewPembayaranSewa(values, ctx);
  const raw = preview.raw as Record<string, any>;
  const nominal = Math.round(raw.grandTotal);

  return withLock(`penghuni:${penghuni}`, 15, async () => {
    await assertHeaders(SHEETS.LOG_INPUT_TRANSAKSI, HEADER_RANGE, EXPECTED_HEADERS);

    // NONAKTIF SEMENTARA UTK TESTING (2026-08-02, minta developer) — JANGAN dibiarkan
    // nonaktif di produksi, aktifkan lagi setelah selesai tes modul Pembayaran Sewa.
    // Anti bayar 2× untuk penghuni & periode yang sama (overlap tanggal mulai..+jumlah bulan).
    // const existing = await readTable(SHEETS.LOG_INPUT_TRANSAKSI, "'Input Sewa Dimuka'!A:F");
    // const newStart = new Date(`${tanggalBayar}T00:00:00`);
    // const newEnd = addMonths(tanggalBayar, jumlahBulan);
    // for (const r of existing) {
    //   if ((r['Unit / Penyewa'] || '').trim() !== penghuni) continue;
    //   const mulai = (r['Tanggal Mulai'] || '').trim();
    //   const bulan = parseInt(r['Jumlah Bulan'] || '0', 10);
    //   if (!mulai || !bulan) continue;
    //   const exStart = new Date(`${mulai}T00:00:00`);
    //   if (isNaN(exStart.getTime())) continue;
    //   const exEnd = addMonths(mulai, bulan);
    //   if (newStart.getTime() < exEnd.getTime() && exStart.getTime() < newEnd.getTime()) {
    //     throw new Error(`Sudah ada pembayaran untuk ${penghuni} pada periode yang tumpang tindih.`);
    //   }
    // }

    const nominalPerBulan = Math.round(nominal / jumlahBulan);
    const row = await appendRow(SHEETS.LOG_INPUT_TRANSAKSI, "'Input Sewa Dimuka'!A:F", [
      tanggalBayar,
      penghuni,
      nominalPerBulan,
      jumlahBulan,
      akunKasBank,
      'Belum'
    ]);

    // Tulis invoice+payment ke Turso DULU (bukan lagi terakhir): Apps Script sekarang generate
    // invoice dengan BACA row ini langsung dari Turso pakai no_inv, bukan dikirim mentah di
    // payload — row-nya wajib sudah ada di database sebelum Apps Script dipanggil.
    const tursoWarning = await saveInvoiceAndPaymentTurso(raw, jenisPembayaran, tanggalBayar, akunKasBank, nominal);

    // Trigger Apps Script invoice — best-effort, gagal tidak membatalkan pencatatan pembayaran (fallback PRD §6 Modul 2).
    const scriptUrl = APPS_SCRIPT_URL[jenisPembayaran];
    const token = process.env.APPS_SCRIPT_TOKEN;
    let invoiceStatus = 'Belum dipicu (URL/token Apps Script belum diisi di env) — generate manual di Generator Tagihan.';
    if (tursoWarning) {
      invoiceStatus = 'Invoice tidak dipicu karena pencatatan ke database invoice/payment gagal (lihat warning) — generate manual di Generator Tagihan.';
    } else if (scriptUrl && token) {
      try {
        const res = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, mode: 'send', input: { noInv: raw.noInv } })
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

    return {
      target: 'Log Input Transaksi → Input Sewa Dimuka',
      row,
      data: { penghuni, jenisPembayaran, tanggalBayar, nominal, jumlahBulan, akunKasBank, invoiceStatus },
      warning: [lampiranWarning, tursoWarning].filter(Boolean).join(' ') || undefined
    };
  });
};
