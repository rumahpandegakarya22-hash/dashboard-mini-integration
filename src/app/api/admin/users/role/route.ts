import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, setUserRole } from '@/lib/auth';
import { ROLE_LABEL, type Role } from '@/lib/roles';

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  if (user.role !== 'owner') return NextResponse.json({ error: 'Hanya Owner yang bisa ubah role.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { id, role } = body as { id?: string; role?: Role };
  if (!id) return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 });
  if (!role || !(role in ROLE_LABEL)) return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 });

  try {
    await setUserRole(id, role);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal ubah role.' }, { status: 400 });
  }
}
