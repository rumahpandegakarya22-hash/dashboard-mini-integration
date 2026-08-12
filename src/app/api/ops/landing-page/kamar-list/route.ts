import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';

const ALLOWED_ROLES = ['owner', 'pengawas', 'staff_admin', 'staff_marketing'];

/* Daftar nomor kamar fisik + jumlah foto landing per nomor (untuk picker
   panel "Foto Nomor Kamar"). */
export async function GET() {
  const user = await getSessionUser();
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const res = await turso().execute(`
      SELECT k.no_kamar, k.tipe_kamar,
             (SELECT COUNT(*) FROM landing_kamar_photos p WHERE p.no_kamar = k.no_kamar) AS foto
      FROM kamar k
      WHERE k.no_kamar IS NOT NULL
      ORDER BY k.no_kamar ASC
    `);
    const kamar = res.rows.map((r) => ({
      no_kamar: Number(r[0]),
      tipe_kamar: String(r[1] ?? ''),
      foto: Number(r[2] ?? 0),
    }));
    return NextResponse.json({ kamar });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
