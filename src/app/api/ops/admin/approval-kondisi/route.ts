import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';

const ALLOWED_ROLES = ['owner', 'staff_admin'] as const;

function canAccess(role: string): boolean {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
}

const ITEM_NUMS = Array.from({ length: 26 }, (_, i) => String(i + 1).padStart(2, '0'));

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fase = searchParams.get('fase');
  if (fase !== 'awal' && fase !== 'akhir') {
    return NextResponse.json({ error: 'Parameter fase harus awal atau akhir' }, { status: 400 });
  }

  let sql: string;
  if (fase === 'awal') {
    const itemCols = ITEM_NUMS.map((n) => `kk.item${n}_awal`).join(', ');
    sql = `SELECT kk.id, kk.id_penghuni, kk.nama_penghuni, kk.no_kamar, kk.pic,
                  kk.tanggal_cek_awal, kk.status_checkin,
                  ${itemCols},
                  kk.catatan_awal,
                  GROUP_CONCAT(f.url, '|') as foto_urls
           FROM kondisi_kamar kk
           LEFT JOIN kondisi_kamar_foto f ON f.kondisi_kamar_id = kk.id AND f.fase = 'awal'
           WHERE kk.status_checkin = 'Menunggu'
           GROUP BY kk.id
           ORDER BY kk.tanggal_cek_awal ASC`;
  } else {
    const itemCols = ITEM_NUMS.map((n) => `kk.item${n}_akhir`).join(', ');
    sql = `SELECT kk.id, kk.id_penghuni, kk.nama_penghuni, kk.no_kamar, kk.pic,
                  kk.tanggal_cek_akhir, kk.status_checkout,
                  ${itemCols},
                  kk.catatan_akhir,
                  GROUP_CONCAT(f.url, '|') as foto_urls
           FROM kondisi_kamar kk
           LEFT JOIN kondisi_kamar_foto f ON f.kondisi_kamar_id = kk.id AND f.fase = 'akhir'
           WHERE kk.status_checkout = 'Menunggu'
           GROUP BY kk.id
           ORDER BY kk.tanggal_cek_akhir ASC`;
  }

  const result = await turso().execute({ sql, args: [] });
  return NextResponse.json({ data: result.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const body = await req.json() as {
    id?: number;
    fase?: 'awal' | 'akhir';
    action?: 'setujui' | 'tolak';
    by?: string;
  };
  const { id, fase, action, by } = body;

  if (!id || (fase !== 'awal' && fase !== 'akhir') || (action !== 'setujui' && action !== 'tolak') || !by) {
    return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 });
  }

  const newStatus = action === 'setujui' ? 'Disetujui' : 'Ditolak';

  let sql: string;
  if (fase === 'awal') {
    sql = `UPDATE kondisi_kamar
           SET status_checkin = ?, approved_checkin_by = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status_checkin = 'Menunggu'`;
  } else {
    sql = `UPDATE kondisi_kamar
           SET status_checkout = ?, approved_checkout_by = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status_checkout = 'Menunggu'`;
  }

  const result = await turso().execute({ sql, args: [newStatus, by, id] });
  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: 'Bukan status Menunggu' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
