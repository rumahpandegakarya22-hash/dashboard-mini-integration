import { appendRow, assertHeaders } from '../../sheets';
import { withLock } from '../../redis';
import { SHEETS } from '@/config/spreadsheets';
import { normalizePhone, normalizeRoomId, parseDateISO, parseRupiah, required } from '../../validate';
import { getActiveTenants, getRoomFresh } from '../../master';
import { saveLampiran } from './helpers';
import type { SubmitHandler } from '../types';

// Kolom B:M sheet "Log Booking" (Log Sales). Kolom A (No. Booking) & H (Tgl Keluar Est.) = FORMULA,
// tidak ditulis. Header DIKONFIRMASI live 8 Jul (bukan tebakan lagi) — TIDAK ada kolom Upload
// KTP/Kontrak (link file, kalau nanti dibangun, masuk ke kolom Catatan sesuai PRD §7), tapi ADA
// kolom "Alasan Cancel" yang sebelumnya tidak diketahui.
const HEADER_RANGE = "'Log Booking'!B1:M1";
const EXPECTED_HEADERS = [
  'Tanggal Booking',
  'Nama Penyewa',
  'No. HP',
  'Kamar',
  'Tgl Masuk',
  'Durasi (bulan)',
  'Tgl Keluar (Est.)',
  'Harga Disepakati (Rp)',
  'Status Booking',
  'Alasan Cancel',
  'Sumber Leads',
  'Catatan'
];

const DURATIONS = [1, 2, 3, 6, 9, 12];

function addDays(iso: string, days: number): Date {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d;
}

function tryNormalizePhone(v: string): string | null {
  try {
    return normalizePhone(v);
  } catch {
    return null;
  }
}

export const submitPenghuniBaru: SubmitHandler = async (values, ctx) => {
  const tanggalBooking = parseDateISO(String(values.tanggalBooking ?? ''));
  const namaPenyewa = required(values.namaPenyewa, 'Nama Penyewa');
  if (namaPenyewa.length < 3) throw new Error('Nama Penyewa minimal 3 karakter.');
  const noHp = normalizePhone(String(values.noHp ?? ''));
  const kamarId = normalizeRoomId(String(values.kamar ?? ''));
  const tglMasuk = parseDateISO(String(values.tglMasuk ?? ''));
  const durasi = parseInt(String(values.durasiBulan ?? ''), 10);
  if (!DURATIONS.includes(durasi)) throw new Error('Durasi tidak valid.');
  const hargaDisepakati = parseRupiah(values.hargaDisepakati as string | number);
  const statusBooking = required(values.statusBooking, 'Status Booking');
  const sumberLeads = required(values.sumberLeads, 'Sumber Leads');
  const catatan = String(values.catatan ?? '').trim();

  // Tanggal Booking tidak boleh masa depan >7 hari
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingDate = new Date(`${tanggalBooking}T00:00:00`);
  if ((bookingDate.getTime() - today.getTime()) / 86400000 > 7) {
    throw new Error('Tanggal Booking tidak boleh lebih dari 7 hari ke depan.');
  }

  // Tgl Masuk >= Tanggal Booking - 1 hari
  const minMasuk = addDays(tanggalBooking, -1);
  if (new Date(`${tglMasuk}T00:00:00`).getTime() < minMasuk.getTime()) {
    throw new Error('Tgl Masuk tidak boleh lebih awal dari 1 hari sebelum Tanggal Booking.');
  }

  return withLock(`kamar:${kamarId}`, 15, async () => {
    // Double-occupancy: baca ulang status kamar terkini (bukan dari cache 5 menit).
    const room = await getRoomFresh(kamarId);
    if (!room) throw new Error(`Kamar ${kamarId} tidak ditemukan di master.`);
    if (room.status.toLowerCase() === 'terisi') {
      throw new Error(`Kamar ${kamarId} sudah terisi. Pilih kamar lain.`);
    }

    // Pita kewajaran harga: negosiasi normal boleh, tapi cegah salah ketik (harga nyaris 0 atau 10x lipat).
    const listed = parseRupiah(String(room.hargaBulan));
    if (listed > 0 && (hargaDisepakati < listed * 0.5 || hargaDisepakati > listed * 2)) {
      throw new Error(
        'Harga disepakati (Rp' + hargaDisepakati + ') terlalu jauh dari harga kamar (Rp' + listed + '). Perlu persetujuan Owner.'
      );
    }

    // No. HP unik terhadap penghuni aktif.
    const tenants = await getActiveTenants();
    if (tenants.some((t) => tryNormalizePhone(t.hp) === noHp)) {
      throw new Error(`No. HP ${noHp} sudah terdaftar sebagai penghuni aktif.`);
    }

    await assertHeaders(SHEETS.LOG_SALES, HEADER_RANGE, EXPECTED_HEADERS);

    const row = await appendRow(SHEETS.LOG_SALES, "'Log Booking'!B:M", [
      tanggalBooking,
      namaPenyewa,
      `'${noHp}`, // apostrof: paksa Sheets simpan sebagai TEKS, bukan angka
      kamarId,
      tglMasuk,
      durasi,
      null, // H: Tgl Keluar (Est.) — FORMULA, jangan ditulis
      hargaDisepakati,
      statusBooking,
      '', // K: Alasan Cancel — kosong saat booking baru, diisi manual kalau nanti dibatalkan
      sumberLeads,
      catatan
    ]);

    const warning = await saveLampiran(values, ctx, `Penghuni Baru — ${namaPenyewa} (Kamar ${kamarId})`, 'Admin');

    return {
      target: 'Log Sales → Log Booking',
      row,
      data: { tanggalBooking, namaPenyewa, noHp, kamarId, tglMasuk, durasi, hargaDisepakati, statusBooking, sumberLeads, catatan },
      warning
    };
  });
};
