import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardAuth, requireOwner } from '@/lib/dashboard/api-guard';
import { disableDashboardUser } from '@/lib/core/auth';

/** Paritas `POST /api/users/disable` server.js — termasuk larangan menonaktifkan diri sendiri. */
export async function POST(req: NextRequest) {
  const g = await requireDashboardAuth();
  if (!g.ok) return g.res;
  const denied = requireOwner(g.user);
  if (denied) return denied;

  const { username } = (await req.json().catch(() => ({}))) as { username?: string };
  if (String(username || '').toLowerCase() === String(g.user.username).toLowerCase()) {
    return NextResponse.json({ error: 'Tidak bisa menonaktifkan akun sendiri' }, { status: 400 });
  }
  try {
    const r = await disableDashboardUser(String(username || ''));
    if (r === 'notfound') return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/dashboard/users/disable] gagal nonaktifkan akun:', e);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
