import { NextResponse } from 'next/server';
import { requireDashboardAuth, requireOwner } from '@/lib/dashboard/api-guard';
import { listDashboardUsers } from '@/lib/core/auth';

/** Paritas `GET /api/users` server.js — array datar, bentuk field identik. */
export async function GET() {
  const g = await requireDashboardAuth();
  if (!g.ok) return g.res;
  const denied = requireOwner(g.user);
  if (denied) return denied;
  try {
    return NextResponse.json(await listDashboardUsers());
  } catch (e) {
    console.error('[api/dashboard/users] gagal baca daftar akun:', e);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
