import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { getConfig, setConfig } from '@/lib/app-config';

function canAccess(role: string) {
  return role === 'owner' || role === 'staff_admin';
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });

  const enabled = (await getConfig('deposit_enabled')) ?? '0';
  const nominal = (await getConfig('deposit_nominal')) ?? '0';
  return NextResponse.json({ enabled: enabled === '1', nominal: Number(nominal) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !canAccess(user.role)) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });

  const body = await req.json() as { enabled?: boolean; nominal?: number };
  if (typeof body.enabled === 'boolean') await setConfig('deposit_enabled', body.enabled ? '1' : '0', user.name);
  if (typeof body.nominal === 'number' && body.nominal >= 0) await setConfig('deposit_nominal', String(body.nominal), user.name);

  return NextResponse.json({ ok: true });
}
