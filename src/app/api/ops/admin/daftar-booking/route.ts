import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { invalidateTenantsCache, updateRoomStatus } from '@/lib/master';

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
    sql: `SELECT b.no_booking, COALESCE(NULLIF(b.id_penghuni, ''), b.no_booking) AS id_penghuni,
                 b.nama_penyewa, b.kamar_no, b.tgl_masuk,
                 b.no_hp, b.status_booking,
                 kk.id as kk_id, kk.status_checkin
          FROM booking b
          LEFT JOIN kondisi_kamar kk ON kk.id = (
            SELECT MAX(k2.id) FROM kondisi_kamar k2
            WHERE k2.id_penghuni = COALESCE(NULLIF(b.id_penghuni, ''), b.no_booking))
          WHERE b.status_booking = 'Konfirmasi'
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
    sql: `SELECT COALESCE(NULLIF(id_penghuni, ''), no_booking) AS kunci, kamar_no FROM booking WHERE no_booking = ?`,
    args: [no_booking],
  });
  if (bookingRes.rows.length === 0) {
    return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 });
  }
  const id_penghuni = bookingRes.rows[0].kunci as string;
  const kamarNo = String(bookingRes.rows[0].kamar_no ?? '');

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
            AND status_booking = 'Konfirmasi'`,
    args: [no_booking],
  });
  if (updateRes.rowsAffected === 0) {
    return NextResponse.json({ error: 'Booking harus berstatus Konfirmasi untuk check-in.' }, { status: 409 });
  }

  // Trigger sudah membuat id_penghuni (KTD-...). Pindahkan kunci inspeksi dari no_booking
  // ke id itu supaya Pre-Check Out menemukan data kondisi awal.
  if (id_penghuni === no_booking) {
    await turso().execute({
      sql: `UPDATE kondisi_kamar
            SET id_penghuni = (SELECT id_penghuni FROM booking WHERE no_booking = ?)
            WHERE id_penghuni = ?
              AND (SELECT id_penghuni FROM booking WHERE no_booking = ?) IS NOT NULL`,
      args: [no_booking, no_booking, no_booking],
    });
  }

  // Trigger DB hanya membuat occupancy_history & active_tenant. Sisanya dikerjakan di sini,
  // sama seperti jalur check-in Edit Data: salin tambahan listrik, set kamar Terisi, bersihkan cache.
  const db = turso();
  const warnings: string[] = [];
  try {
    await db.batch(
      [
        {
          sql: `UPDATE occupancy_history SET tambahan_listrik = (SELECT tambahan_listrik FROM booking WHERE no_booking = ?)
                WHERE id_penghuni = (SELECT id_penghuni FROM booking WHERE no_booking = ?) AND tambahan_listrik IS NULL`,
          args: [no_booking, no_booking],
        },
        {
          sql: `UPDATE active_tenant SET tambahan_listrik = (SELECT tambahan_listrik FROM booking WHERE no_booking = ?)
                WHERE id_penghuni = (SELECT id_penghuni FROM booking WHERE no_booking = ?) AND tambahan_listrik IS NULL`,
          args: [no_booking, no_booking],
        },
      ],
      'write'
    );
  } catch (e) {
    console.error('[daftar-booking] gagal salin tambahan listrik:', e instanceof Error ? e.message : e);
    warnings.push('Tambahan listrik gagal disalin ke penghuni — isi manual di Ubah Data Penghuni.');
  }
  try {
    if (kamarNo) await updateRoomStatus(kamarNo, 'Terisi');
  } catch (e) {
    console.error('[daftar-booking] gagal set status kamar:', e instanceof Error ? e.message : e);
    warnings.push(`Status kamar ${kamarNo} gagal diubah ke Terisi — ubah manual.`);
  }
  await invalidateTenantsCache().catch(() => undefined);

  return NextResponse.json({ ok: true, warning: warnings.join(' ') || undefined });
}
