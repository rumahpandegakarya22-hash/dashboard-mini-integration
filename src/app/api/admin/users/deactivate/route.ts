import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, deactivateUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  if (user.role !== 'owner') return NextResponse.json({ error: 'Hanya Owner yang bisa nonaktifkan user.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { username } = body as { username?: string };
  if (!username) return NextResponse.json({ error: 'username wajib diisi.' }, { status: 400 });
  if (username === user.username) return NextResponse.json({ error: 'Tidak bisa nonaktifkan akun sendiri.' }, { status: 400 });

  try {
    await deactivateUser(username);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal nonaktifkan user.' }, { status: 400 });
  }
}
