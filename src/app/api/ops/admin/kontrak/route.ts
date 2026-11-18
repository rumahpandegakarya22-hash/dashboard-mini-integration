import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { getConfig, setConfig } from '@/lib/app-config';

function canAccess(role: string) {
  return role === 'owner' || role === 'staff_admin';
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });

  const enabled = (await getConfig('kontrak_enabled')) ?? '0';
  return NextResponse.json({ enabled: enabled === '1' });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });

  const body = await req.json() as { enabled?: boolean };
  if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  await setConfig('kontrak_enabled', body.enabled ? '1' : '0', user.name);

  return NextResponse.json({ ok: true });
}
