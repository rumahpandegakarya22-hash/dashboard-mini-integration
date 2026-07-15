import { NextResponse } from 'next/server';
import { getSessionUser, listAllUsers } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  if (user.role !== 'owner') return NextResponse.json({ error: 'Hanya Owner yang bisa mengelola user.' }, { status: 403 });

  const data = await listAllUsers();
  return NextResponse.json({ ok: true, data });
}
