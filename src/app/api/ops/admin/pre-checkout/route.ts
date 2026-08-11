import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';

const ALLOWED_ROLES = ['owner', 'staff_admin', 'staff_inspeksi'] as const;

function canAccess(role: string): boolean {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
}

const ITEM_COLS_AKHIR = Array.from({ length: 26 }, (_, i) => `item${String(i + 1).padStart(2, '0')}_akhir`);

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const itemSelect = ITEM_COLS_AKHIR.map((c) => `kk.${c}`).join(', ');

  const result = await turso().execute({
    sql: `SELECT at.kamar_id, at.no_kamar, at.nama_lengkap, at.no_hp, at.id_penghuni,
                 kk.id as kk_id, kk.status_checkout,
                 ${itemSelect},
                 kk.catatan_akhir, kk.tanggal_cek_akhir
          FROM active_tenant at
          LEFT JOIN kondisi_kamar kk ON kk.id_penghuni = at.id_penghuni
          WHERE kk.status_checkout IS NULL OR kk.status_checkout = 'Draft'
          ORDER BY at.no_kamar ASC`,
    args: [],
  });

  return NextResponse.json({ data: result.rows });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  type ItemKey = `item${string}`;
  const body = await req.json() as {
    kk_id: number;
    items: Record<ItemKey, string>;
    catatan_akhir: string;
    tanggal_cek_akhir: string;
    pic: string;
  };

  const { kk_id, items, catatan_akhir, tanggal_cek_akhir, pic } = body;

  const itemArgs = ITEM_COLS_AKHIR.map((col) => {
    const key = col.replace('_akhir', '') as ItemKey;
    return items[key] ?? 'Baik';
  });

  const res = await turso().execute({
    sql: `UPDATE kondisi_kamar SET
            ${ITEM_COLS_AKHIR.map((c) => `${c}=?`).join(', ')},
            catatan_akhir=?, tanggal_cek_akhir=?, pic=?,
            status_checkout='Menunggu', updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND status_checkout NOT IN ('Menunggu','Disetujui')`,
    args: [...itemArgs, catatan_akhir, tanggal_cek_akhir, pic, kk_id],
  });

  if (res.rowsAffected === 0) {
    return NextResponse.json({ error: 'Sudah diajukan atau disetujui' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
