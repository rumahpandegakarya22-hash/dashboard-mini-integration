import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardAuth, requireOwner } from '@/lib/dashboard/api-guard';
import { approveDashboardUser } from '@/lib/core/auth';
import { DASHBOARD_ROLES, type DashboardRole } from '@/config/dashboard-access';

/** Paritas `POST /api/users/approve` server.js. */
export async function POST(req: NextRequest) {
  const g = await requireDashboardAuth();
  if (!g.ok) return g.res;
  const denied = requireOwner(g.user);
  if (denied) return denied;

  const { username, role } = (await req.json().catch(() => ({}))) as {
    username?: string;
    role?: string;
  };
  if (!role || !(DASHBOARD_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
  }
  try {
    const r = await approveDashboardUser(String(username || ''), role as DashboardRole);
    if (r === 'notfound') return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/dashboard/users/approve] gagal simpan role/status:', e);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
