import { appendRow, assertHeaders, readTable } from '../../sheets';
import { withLock } from '../../redis';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';
import { previewPembayaranSewa } from './pembayaran-sewa-preview';
import type { SubmitHandler } from '../types';

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

    return {
      target: 'Log Input Transaksi → Input Sewa Dimuka',
      row,
      data: { penghuni, jenisPembayaran, tanggalBayar, nominal, jumlahBulan, akunKasBank, invoiceStatus }
    };
  });
};
