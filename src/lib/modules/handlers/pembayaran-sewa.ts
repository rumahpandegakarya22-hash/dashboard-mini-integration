import { appendRow, assertHeaders, readTable } from '../../sheets';
import { withLock } from '../../redis';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, parseRupiah, required } from '../../validate';
import { getRoomFresh, getTenantByLabel } from '../../master';
import type { SubmitHandler } from '../types';

// Kolom A:F sheet "Input Sewa Dimuka" (Log Input Transaksi). Jurnal digenerate Apps Script "Kost Tools"
// dari sheet ini — TIDAK menulis langsung ke sheet Transaksi (PRD §6/§8 Modul 2). Header DIKONFIRMASI
// live 8 Jul (bukan tebakan lagi) — perhatikan "Unit / Penyewa" pakai spasi di sekitar garis miring.
const HEADER_RANGE = "'Input Sewa Dimuka'!A1:F1";
const EXPECTED_HEADERS = ['Tanggal Mulai', 'Unit / Penyewa', 'Nominal per Bulan', 'Jumlah Bulan', 'Akun Kas/Bank', 'Sudah Digenerate?'];
const DURATIONS = [1, 2, 3, 6, 9, 12];

const APPS_SCRIPT_URL: Record<string, string | undefined> = {
  DP: process.env.APPS_SCRIPT_INVOICE_DP_URL,
  Sewa: process.env.APPS_SCRIPT_INVOICE_SEWA_URL
};

function addMonths(iso: string, months: number): Date {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d;
}

export const submitPembayaranSewa: SubmitHandler = async (values) => {
  const penghuni = required(values.penghuni, 'Penghuni'); // format baku "KTD-x — Nama"
  const jenisPembayaran = required(values.jenisPembayaran, 'Jenis Pembayaran');
  if (jenisPembayaran !== 'DP' && jenisPembayaran !== 'Sewa') throw new Error('Jenis Pembayaran tidak valid.');
  const tanggalBayar = parseDateISO(String(values.tanggalBayar ?? ''));
  const nominal = parseRupiah(values.nominal as string | number);
  const jumlahBulan = parseInt(String(values.jumlahBulan ?? ''), 10);
  if (!DURATIONS.includes(jumlahBulan)) throw new Error('Jumlah Bulan tidak valid.');
  const akunKasBank = required(values.akunKasBank, 'Akun Kas/Bank');

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

    // Warning (bukan blokir) jika nominal beda dari harga kamar × jumlah bulan.
    let warning: string | undefined;
    const tenant = await getTenantByLabel(penghuni);
    if (tenant?.kamar) {
      const room = await getRoomFresh(tenant.kamar);
      if (room && room.hargaBulan > 0) {
        const expected = room.hargaBulan * jumlahBulan;
        if (Math.abs(expected - nominal) > 1) {
          warning = `Nominal (Rp${nominal.toLocaleString('id-ID')}) berbeda dari harga kamar × jumlah bulan (Rp${expected.toLocaleString('id-ID')}). Periksa kembali.`;
        }
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
    const scriptUrl = APPS_SCRIPT_URL[jenisPembayaran];
    const token = process.env.APPS_SCRIPT_TOKEN;
    let invoiceStatus = 'Belum dipicu (URL/token Apps Script belum diisi di env — isi manual di Generator Tagihan).';
    if (scriptUrl && token) {
      try {
        const res = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, penghuni, jenisPembayaran, tanggalBayar, nominal, jumlahBulan })
        });
        invoiceStatus = res.ok ? 'Invoice dipicu.' : `Gagal memicu invoice (HTTP ${res.status}) — generate manual di Generator Tagihan.`;
      } catch (e: any) {
        invoiceStatus = `Gagal memicu invoice: ${e?.message || 'unknown error'} — generate manual di Generator Tagihan.`;
      }
    }

    return {
      target: 'Log Input Transaksi → Input Sewa Dimuka',
      row,
      data: { penghuni, jenisPembayaran, tanggalBayar, nominal, jumlahBulan, akunKasBank, invoiceStatus },
      warning
    };
  });
};
