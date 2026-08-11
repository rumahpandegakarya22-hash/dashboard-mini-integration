import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';

const ALLOWED_ROLES = ['owner', 'staff_admin'] as const;

function canAccess(role: string): boolean {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const result = await turso().execute({
    sql: `SELECT b.no_booking, b.id_penghuni, b.nama_penyewa, b.kamar_no, b.tgl_masuk,
                 b.no_hp, b.status_booking,
                 kk.id as kk_id, kk.status_checkin
          FROM booking b
          LEFT JOIN kondisi_kamar kk ON kk.id_penghuni = b.id_penghuni
          WHERE b.status_booking IS NOT NULL
            AND b.status_booking NOT IN ('Check-in', 'Check-out', 'Batal')
          ORDER BY b.tgl_masuk ASC`,
    args: [],
  });

  return NextResponse.json({ data: result.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const body = await req.json() as { no_booking?: string };
  const { no_booking } = body;
  if (!no_booking) {
    return NextResponse.json({ error: 'no_booking wajib diisi' }, { status: 400 });
  }

  // Ambil id_penghuni untuk cek status inspeksi
  const bookingRes = await turso().execute({
    sql: `SELECT id_penghuni FROM booking WHERE no_booking = ?`,
    args: [no_booking],
  });
  if (bookingRes.rows.length === 0) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
  }
  const id_penghuni = bookingRes.rows[0].id_penghuni as string;

  // Validasi: inspeksi harus sudah disetujui
  const kkRes = await turso().execute({
    sql: `SELECT status_checkin FROM kondisi_kamar WHERE id_penghuni = ? ORDER BY id DESC LIMIT 1`,
    args: [id_penghuni],
  });
  const statusCheckin = kkRes.rows[0]?.status_checkin as string | undefined;
  if (statusCheckin !== 'Disetujui') {
    return NextResponse.json({ error: 'Inspeksi belum disetujui' }, { status: 400 });
  }

  // Update status_booking ke Check-in
  const updateRes = await turso().execute({
    sql: `UPDATE booking
          SET status_booking = 'Check-in'
          WHERE no_booking = ?
            AND status_booking NOT IN ('Check-in', 'Check-out', 'Batal')`,
    args: [no_booking],
  });
  if (updateRes.rowsAffected === 0) {
    return NextResponse.json({ error: 'Sudah check-in atau dibatalkan' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
