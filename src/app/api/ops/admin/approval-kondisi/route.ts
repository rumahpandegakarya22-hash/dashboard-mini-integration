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
                  kk.deposit_dikembalikan, kk.catatan_deposit,
                  (SELECT b.deposit FROM booking b WHERE b.id_penghuni = kk.id_penghuni
                   ORDER BY b.tanggal_booking DESC LIMIT 1) AS deposit_nominal,
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
    deposit_dikembalikan?: number;
    catatan_deposit?: string;
  };
  const { id, fase, action } = body;

  if (!id || (fase !== 'awal' && fase !== 'akhir') || (action !== 'setujui' && action !== 'tolak')) {
    return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 });
  }

  const newStatus = action === 'setujui' ? 'Disetujui' : 'Ditolak';
  const by = user.name;

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

  let args: (string | number | null)[] = [newStatus, by, id];

  /* Check-out disetujui = keputusan deposit ikut disimpan. Nominal deposit dibaca dari
     database, bukan dari klien, supaya pengembalian tidak bisa melebihi deposit asli. */
  if (fase === 'akhir' && action === 'setujui') {
    const dep = await turso().execute({
      sql: `SELECT COALESCE((SELECT b.deposit FROM booking b WHERE b.id_penghuni = kk.id_penghuni
                             ORDER BY b.tanggal_booking DESC LIMIT 1), 0) AS deposit
            FROM kondisi_kamar kk WHERE kk.id = ?`,
      args: [id],
    });
    if (dep.rows.length === 0) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    const deposit = Number(dep.rows[0].deposit ?? 0);

    const dikembalikan = deposit > 0 ? Math.round(Number(body.deposit_dikembalikan ?? deposit)) : 0;
    if (!Number.isFinite(dikembalikan) || dikembalikan < 0 || dikembalikan > deposit) {
      return NextResponse.json({ error: `Pengembalian deposit harus antara Rp0 dan Rp${deposit.toLocaleString('id-ID')}.` }, { status: 400 });
    }
    const catatanDeposit = String(body.catatan_deposit ?? '').trim().slice(0, 300);
    if (dikembalikan < deposit && catatanDeposit.length < 5) {
      return NextResponse.json({ error: 'Alasan potongan deposit wajib diisi (minimal 5 karakter).' }, { status: 400 });
    }

    sql = `UPDATE kondisi_kamar
           SET status_checkout = ?, approved_checkout_by = ?, deposit_dikembalikan = ?, catatan_deposit = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status_checkout = 'Menunggu'`;
    args = [newStatus, by, dikembalikan, catatanDeposit || null, id];
  }

  const result = await turso().execute({ sql, args });
  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: 'Bukan status Menunggu' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
