import { turso } from '../../core/turso';
import { withLock } from '../../core/redis';
import { normalizePhone, normalizeRoomId, parseDateISO, parseRupiah, required } from '../../core/validate';
import { getActiveTenants, getRoomFresh, invalidateTenantsCache } from '../../master';
import { resolveOccupancyId, saveLampiran } from './helpers';
import type { SubmitHandler } from '../types';

/** Ejaan status_booking yang dipakai tabel `booking` & dicocokkan trigger.
 *  Kunci = ejaan apa adanya dari dropdown (warisan tab SETTING spreadsheet). */
const STATUS_BOOKING_DB: Record<string, string> = {
  'check-in': 'Check-in',
  'check-out': 'Check-out',
  konfirmasi: 'Konfirmasi',
  pending: 'Pending',
  dibatalkan: 'Dibatalkan'
};

function normalizeStatusBooking(v: string): string {
  return STATUS_BOOKING_DB[v.trim().toLowerCase()] ?? v.trim();
}

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
  /* Samakan ejaan status dgn konvensi DATABASE. Dropdown mewarisi ejaan sheet
     ("Check-In"/"Check-Out", huruf I/O besar), sedangkan trigger booking
     mencocokkan PERSIS 'Check-in' / 'Check-out' (perbandingan teks SQLite
     case-sensitive). Tanpa normalisasi ini booking tersimpan tapi trigger
     TIDAK jalan — id_penghuni, occupancy_history, dan active_tenant tidak
     pernah terbentuk, jadi penghuni baru tak pernah muncul sebagai aktif. */
  const statusDb = normalizeStatusBooking(statusBooking);
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

    /* no_booking = 'BK-YYMM-NNN', urut per bulan. Dihitung DI DALAM statement
       INSERT (bukan SELECT terpisah lalu INSERT) supaya penomoran tetap atomik:
       withLock di sini per-KAMAR, jadi dua booking kamar berbeda bisa berjalan
       bersamaan dan akan bentrok kalau nomornya dihitung di aplikasi.
       substr(no_booking,4,4) = YYMM, substr(no_booking,-3) = urutan. */
    const yymm = tanggalBooking.slice(2, 4) + tanggalBooking.slice(5, 7);

    const res = await turso().execute({
      sql: `INSERT INTO booking
              (no_booking, tanggal_booking, nama_penyewa, no_hp, kamar_no, tgl_masuk,
               durasi_bulan, harga_disepakati, status_booking, alasan_cancel,
               sumber_leads, catatan)
            VALUES (
              printf('BK-%s-%03d', ?, COALESCE((
                SELECT MAX(CAST(substr(no_booking, -3) AS INTEGER)) FROM booking
                WHERE substr(no_booking, 4, 4) = ?
              ), 0) + 1),
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING no_booking`,
      args: [
        yymm,
        yymm,
        tanggalBooking,
        namaPenyewa,
        noHp,
        kamarId,
        tglMasuk,
        durasi,
        hargaDisepakati,
        statusDb,
        '', // Alasan Cancel — kosong saat booking baru
        sumberLeads,
        catatan
      ]
    });
    const noBooking = res.rows.length > 0 ? String(res.rows[0].no_booking) : '(tidak diketahui)';

    // statusDb bisa 'Check-in' → trigger DB langsung isi active_tenant; cache dropdown penghuni
    // harus ikut dibersihkan supaya penghuni baru langsung muncul, bukan nunggu TTL 5 menit.
    if (statusDb === 'Check-in') await invalidateTenantsCache();

    // ID Penghuni dibuat TRIGGER database saat status 'Check-in', jadi baru bisa
    // dibaca setelah INSERT di atas. Untuk booking yang belum check-in, id itu
    // memang belum ada — nomor booking dipakai sebagai gantinya supaya berkas di
    // Drive tetap bisa ditelusuri.
    const idPenghuni = statusDb === 'Check-in' ? (await resolveOccupancyId(kamarId)) || noBooking : noBooking;
    const penamaanUmum = { idPenghuni, noKamar: kamarId, nama: namaPenyewa };

    const warningIdentitas = await saveLampiran(values, ctx, `Penghuni Baru — ${namaPenyewa} (Kamar ${kamarId})`, 'Admin', {
      penamaan: { ...penamaanUmum, jenis: String(values.jenisDokumen ?? 'Identitas') }
    });
    const warningKontrak = await saveLampiran(values, ctx, `Kontrak Sewa — ${namaPenyewa} (Kamar ${kamarId})`, 'Admin', {
      field: 'lampiranKontrak',
      penamaan: { ...penamaanUmum, jenis: 'Kontrak' }
    });

    return {
      target: `Turso → booking (${noBooking})`,
      data: { noBooking, tanggalBooking, namaPenyewa, noHp, kamarId, tglMasuk, durasi, hargaDisepakati, statusBooking: statusDb, sumberLeads, catatan },
      warning: [warningIdentitas, warningKontrak].filter(Boolean).join(' ') || undefined
    };
  });
};
