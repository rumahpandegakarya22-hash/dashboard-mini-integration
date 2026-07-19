import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getMasterData } from '@/lib/master';

// Auth sudah dijamin proxy.ts (semua /api/* butuh session valid kecuali /api/auth/login),
// tapi guard di sini jadi lapisan kedua supaya route tidak pernah bocor tanpa sesi valid.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  try {
    const { type } = await params;
    const data = await getMasterData(type);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[master]', e);
    return NextResponse.json({ error: 'Terjadi kesalahan. Coba lagi.' }, { status: 400 });
  }
}
