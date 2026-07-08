import { appendRow, assertHeaders } from '../../sheets';
import { withLock } from '../../redis';
import { SHEETS } from '@/config/spreadsheets';
import { parseDateISO, required } from '../../validate';
import { getRoomFresh, getTenantByLabel, updateRoomStatus } from '../../master';
import type { SubmitHandler } from '../types';

// Sheet BARU "Log Pindah Kamar" (dibuat manual saat setup, ID via env SHEET_ID_PINDAH_KAMAR).
// Karena sheet ini baru, header di bawah adalah KONTRAK yang didefinisikan app — user harus
// membuat kolomnya persis begini saat setup (bukan tebakan dari sheet eksisting).
const HEADER_RANGE = "'Log Pindah Kamar'!A1:K1";
const EXPECTED_HEADERS = [
  'Tanggal',
  'Penghuni',
  'Kamar Lama',
  'Kamar Baru',
  'Harga Lama',
  'Harga Baru',
  'Alasan',
  'Efektif Mulai',
  'Catatan',
  'Diinput Oleh',
  'Timestamp'
];

export const submitPindahKamar: SubmitHandler = async (values, ctx) => {
  const tanggal = parseDateISO(String(values.tanggal ?? ''));
  const penghuni = required(values.penghuni, 'Penghuni'); // format baku "KTD-x — Nama"
  const kamarBaru = required(values.kamarBaru, 'Kamar Baru');
  const alasan = required(values.alasan, 'Alasan');
  const efektifMulai = values.efektifMulai ? parseDateISO(String(values.efektifMulai)) : tanggal;
  const catatan = String(values.catatan ?? '').trim();
  if (!SHEETS.PINDAH_KAMAR) {
    throw new Error('Spreadsheet Log Pindah Kamar belum dibuat/diisi (SHEET_ID_PINDAH_KAMAR di .env.local).');
  }

  return withLock(`kamar:${kamarBaru}`, 15, async () => {
    const tenant = await getTenantByLabel(penghuni);
    if (!tenant?.kamar) throw new Error(`Kamar lama tidak terdeteksi untuk penghuni "${penghuni}".`);
    const kamarLama = tenant.kamar;
    if (kamarBaru === kamarLama) throw new Error('Kamar Baru harus berbeda dari Kamar Lama.');

    const roomBaru = await getRoomFresh(kamarBaru);
    if (!roomBaru) throw new Error(`Kamar ${kamarBaru} tidak ditemukan di master.`);
    if (roomBaru.status.toLowerCase() === 'terisi') {
      throw new Error(`Kamar ${kamarBaru} sudah terisi. Pilih kamar lain.`);
    }
    const roomLama = await getRoomFresh(kamarLama);

    await assertHeaders(SHEETS.PINDAH_KAMAR, HEADER_RANGE, EXPECTED_HEADERS);
    const row = await appendRow(SHEETS.PINDAH_KAMAR, "'Log Pindah Kamar'!A:K", [
      tanggal,
      penghuni,
      kamarLama,
      kamarBaru,
      roomLama?.hargaBulan ?? '',
      roomBaru.hargaBulan,
      alasan,
      efektifMulai,
      catatan,
      ctx.user.name,
      new Date().toISOString()
    ]);

    await updateRoomStatus(kamarBaru, 'Terisi');
    await updateRoomStatus(kamarLama, 'Kosong');

    const selisih = roomLama ? roomBaru.hargaBulan - roomLama.hargaBulan : 0;
    return {
      target: 'Log Pindah Kamar',
      row,
      data: { tanggal, penghuni, kamarLama, kamarBaru, alasan, efektifMulai, catatan },
      warning:
        selisih !== 0
          ? `Selisih harga: Rp${selisih.toLocaleString('id-ID')}/bln. Sesuaikan tagihan berikutnya di Modul Pembayaran Sewa.`
          : undefined
    };
  });
};
