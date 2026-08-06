import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { canAccess } from '@/lib/core/roles';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';
import { urlBerkas } from '@/lib/teman-rara';

/**
 * Review pendaftaran penghuni baru yang mengisi sendiri lewat aplikasi Teman Rara.
 *
 * Formulirnya menulis ke DUA tabel: `booking` (data transaksi, dipakai seluruh
 * alur operasional yang sudah ada) dan `tr_pendaftaran` (data diri lengkap —
 * kontak darurat, institusi, scan identitas, bukti DP). Yang selama ini terlihat
 * di Ops hanya baris `booking`; 20-an kolom data diri tidak muncul di mana pun,
 * jadi verifikasinya terpaksa manual lewat SQL. Endpoint ini menyatukan keduanya.
 *
 * Keputusan review HANYA menulis 'Konfirmasi' atau 'Dibatalkan'. Nilai 'Check-in'
 * sengaja TIDAK pernah ditulis dari sini: ada trigger database yang bereaksi
 * padanya dengan membuat baris occupancy_history & active_tenant. Check-in tetap
 * lewat alurnya sendiri supaya penghuni tidak terbentuk sebelum benar-benar masuk.
 */

const LIMIT = 50;

const STATUS_REVIEW = { konfirmasi: 'Konfirmasi', tolak: 'Dibatalkan' } as const;
type Aksi = keyof typeof STATUS_REVIEW;

async function gate() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!canAccess(user.role, 'penghuni-baru')) {
    return { error: NextResponse.json({ error: 'Divisi kamu tidak menangani pendaftaran.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;

  const semua = req.nextUrl.searchParams.get('filter') === 'semua';
  const res = await turso().execute(
    `SELECT p.no_booking, p.email, p.nama_lengkap, p.nama_panggilan, p.asal_daerah, p.no_hp, p.no_kamar,
            p.rencana_masuk, p.pekerjaan, p.program_studi, p.institusi,
            p.darurat1_nama, p.darurat1_nomor, p.darurat1_relasi,
            p.darurat2_nama, p.darurat2_nomor, p.darurat2_relasi,
            p.jumlah_gadget, p.barang_elektronik, p.url_identitas, p.url_bukti_dp, p.created_at,
            b.status_booking, b.harga_disepakati, b.durasi_bulan, b.alasan_cancel, b.tanggal_booking
     FROM tr_pendaftaran p
     JOIN booking b ON b.no_booking = p.no_booking
     ${semua ? '' : "WHERE b.status_booking = 'Pending'"}
     ORDER BY p.created_at DESC
     LIMIT ${LIMIT}`
  );

  const data = res.rows.map((r) => {
    const s = (v: unknown) => (v == null ? '' : String(v).trim());
    return {
      noBooking: s(r.no_booking),
      status: s(r.status_booking),
      tanggalDaftar: s(r.created_at).slice(0, 10),
      identitas: {
        namaLengkap: s(r.nama_lengkap),
        namaPanggilan: s(r.nama_panggilan),
        email: s(r.email),
        noHp: s(r.no_hp),
        asalDaerah: s(r.asal_daerah)
      },
      hunian: {
        noKamar: s(r.no_kamar),
        rencanaMasuk: s(r.rencana_masuk),
        durasiBulan: Number(r.durasi_bulan ?? 0),
        hargaDisepakati: Number(r.harga_disepakati ?? 0)
      },
      aktivitas: {
        pekerjaan: s(r.pekerjaan),
        institusi: s(r.institusi),
        programStudi: s(r.program_studi)
      },
      darurat: [
        { nama: s(r.darurat1_nama), nomor: s(r.darurat1_nomor), relasi: s(r.darurat1_relasi) },
        { nama: s(r.darurat2_nama), nomor: s(r.darurat2_nomor), relasi: s(r.darurat2_relasi) }
      ].filter((d) => d.nama),
      barang: {
        jumlahGadget: Number(r.jumlah_gadget ?? 0),
        elektronik: s(r.barang_elektronik)
      },
      berkas: {
        identitas: urlBerkas(s(r.url_identitas)),
        buktiDp: urlBerkas(s(r.url_bukti_dp))
      },
      alasanBatal: s(r.alasan_cancel)
    };
  });

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const user = g.user!;
  const t0 = Date.now();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON yang valid.' }, { status: 400 });
  }

  const noBooking = String(body.noBooking ?? '').trim();
  const aksi = String(body.aksi ?? '').trim() as Aksi;
  const alasan = String(body.alasan ?? '').trim();

  if (!noBooking) return NextResponse.json({ error: 'No. booking wajib diisi.' }, { status: 400 });
  if (!(aksi in STATUS_REVIEW)) {
    return NextResponse.json({ error: 'Aksi harus "konfirmasi" atau "tolak".' }, { status: 400 });
  }
  if (aksi === 'tolak' && alasan.length < 5) {
    return NextResponse.json({ error: 'Alasan penolakan wajib diisi (minimal 5 karakter).' }, { status: 400 });
  }
  if (alasan.length > 500) return NextResponse.json({ error: 'Alasan maksimal 500 karakter.' }, { status: 400 });

  const db = turso();
  const sebelum = await db.execute({
    sql: 'SELECT status_booking, alasan_cancel FROM booking WHERE no_booking = ?',
    args: [noBooking]
  });
  if (sebelum.rows.length === 0) return NextResponse.json({ error: 'Booking tidak ditemukan.' }, { status: 404 });

  const statusLama = String(sebelum.rows[0].status_booking ?? '');
  // Setelah check-in/check-out, booking sudah punya jejak di occupancy_history —
  // memundurkannya lewat layar review akan membuat dua tabel bercerita beda.
  if (statusLama === 'Check-In' || statusLama === 'Check-Out') {
    return NextResponse.json(
      { error: `Booking ini sudah berstatus ${statusLama} — tidak bisa diubah dari layar review.` },
      { status: 409 }
    );
  }

  /* Tambahan listrik menempel ke penghuni, tapi saat review baris penghuninya
     belum ada (baru dibuat trigger ketika status jadi 'Check-in'). Disimpan di
     booking dulu; handler Penghuni Baru menyalinnya ke occupancy_history &
     active_tenant saat check-in dicatat. */
  const listrikRaw = Number(body.tambahanListrik ?? 0);
  const tambahanListrik = Number.isFinite(listrikRaw) && listrikRaw > 0 ? Math.round(listrikRaw) : null;

  const res = await db.execute({
    sql: `UPDATE booking SET status_booking = ?, alasan_cancel = ?,
            tambahan_listrik = COALESCE(?, tambahan_listrik)
          WHERE no_booking = ?`,
    args: [STATUS_REVIEW[aksi], aksi === 'tolak' ? alasan : null, tambahanListrik, noBooking]
  });
  if (res.rowsAffected === 0) return NextResponse.json({ error: 'Booking tidak ditemukan.' }, { status: 404 });

  await writeAudit({
    requestId: `pendaftaran-${noBooking}-${Date.now()}`,
    user,
    moduleId: 'review-pendaftaran',
    action: 'UPDATE',
    target: `Turso → booking (${noBooking})`,
    oldData: sebelum.rows[0],
    newData: { status_booking: STATUS_REVIEW[aksi], alasan_cancel: aksi === 'tolak' ? alasan : null, tambahan_listrik: tambahanListrik },
    durationSec: (Date.now() - t0) / 1000,
    status: 'sukses'
  });

  return NextResponse.json({ ok: true, noBooking, status: STATUS_REVIEW[aksi] });
}
