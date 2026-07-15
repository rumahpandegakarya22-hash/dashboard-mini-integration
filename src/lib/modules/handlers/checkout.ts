import { appendRow, assertHeaders } from '../../sheets';
import { withLock } from '../../redis';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, parseRupiah, required } from '../../validate';
import { getTenantByLabel, updateRoomStatus } from '../../master';
import { saveLampiran } from './helpers';
import type { SubmitHandler } from '../types';

// Sheet BARU "Log Checkout" (dibuat manual saat setup, ID via env SHEET_ID_CHECKOUT). Header di
// bawah adalah KONTRAK yang didefinisikan app (sheet baru, bukan tebakan dari eksisting).
// Status penghuni → "Non-aktif" di Database Penghuni TIDAK ditulis app (sheet itu READ-ONLY,
// formula/IMPORTRANGE — lihat PRD §8.1); asumsinya status penghuni dihitung otomatis dari
// keberadaan baris checkout ini. Verifikasi asumsi ini saat UAT modul ini.
const HEADER_RANGE = "'Log Checkout'!A1:J1";
const EXPECTED_HEADERS = [
  'Tanggal Checkout',
  'Penghuni',
  'Kamar',
  'Tgl Masuk',
  'Tunggakan?',
  'Pengembalian Deposit',
  'Kondisi Kamar',
  'Catatan Kerusakan',
  'Diinput Oleh',
  'Timestamp'
];

export const submitCheckout: SubmitHandler = async (values, ctx) => {
  const tanggalCheckout = parseDateISO(String(values.tanggalCheckout ?? ''));
  const penghuni = required(values.penghuni, 'Penghuni'); // format baku "KTD-x — Nama"
  const tglMasuk = values.tglMasuk ? parseDateISO(String(values.tglMasuk)) : '';
  const adaTunggakan = required(values.adaTunggakan, 'Tunggakan?');
  if (adaTunggakan !== 'Ya' && adaTunggakan !== 'Tidak') throw new Error('Nilai Tunggakan? tidak valid.');
  const nominalTunggakan =
    adaTunggakan === 'Ya' && values.nominalTunggakan ? parseRupiah(values.nominalTunggakan as string | number) : 0;
  const pengembalianDeposit = values.pengembalianDeposit ? parseRupiah(values.pengembalianDeposit as string | number) : 0;
  const kondisiKamar = required(values.kondisiKamar, 'Kondisi Kamar');
  const catatanKerusakan = String(values.catatanKerusakan ?? '').trim();
  if (!SHEETS.CHECKOUT) {
    throw new Error('Spreadsheet Log Checkout belum dibuat/diisi (SHEET_ID_CHECKOUT di .env.local).');
  }

  return withLock(`penghuni:${penghuni}`, 15, async () => {
    const tenant = await getTenantByLabel(penghuni);
    if (!tenant?.kamar) throw new Error(`Kamar tidak terdeteksi untuk penghuni "${penghuni}".`);
    const kamar = tenant.kamar;

    await assertHeaders(SHEETS.CHECKOUT, HEADER_RANGE, EXPECTED_HEADERS);
    const tunggakanText = adaTunggakan === 'Ya' ? `Ya - Rp${nominalTunggakan.toLocaleString('id-ID')}` : 'Tidak';
    const row = await appendRow(SHEETS.CHECKOUT, "'Log Checkout'!A:J", [
      tanggalCheckout,
      penghuni,
      kamar,
      tglMasuk,
      tunggakanText,
      pengembalianDeposit,
      kondisiKamar,
      catatanKerusakan,
      ctx.user.name,
      new Date().toISOString()
    ]);

    await updateRoomStatus(kamar, 'Kosong');

    const lampiranWarning = await saveLampiran(values, ctx, `Checkout — ${penghuni} (${tanggalCheckout})`, 'Admin');
    const tunggakanWarning =
      adaTunggakan === 'Ya' ? `Penghuni masih punya tunggakan Rp${nominalTunggakan.toLocaleString('id-ID')}.` : undefined;

    return {
      target: 'Log Checkout',
      row,
      data: { tanggalCheckout, penghuni, kamar, tglMasuk, adaTunggakan, nominalTunggakan, pengembalianDeposit, kondisiKamar },
      warning: [tunggakanWarning, lampiranWarning].filter(Boolean).join(' ') || undefined
    };
  });
};
