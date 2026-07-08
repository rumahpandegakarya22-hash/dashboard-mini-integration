import { NextRequest, NextResponse } from 'next/server';
import { getMasterData } from '@/lib/master';

// Auth sudah dijamin proxy.ts (semua /api/* butuh session valid kecuali /api/auth/login).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  try {
    const { type } = await params;
    const data = await getMasterData(type);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal memuat master data.' }, { status: 400 });
  }
}
