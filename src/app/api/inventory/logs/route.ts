import { NextResponse } from 'next/server';
import { listLogs } from '@/lib/inventory-admin';
import { requireInventoryAuth, requireOwner, isResponse } from '@/lib/inventory-api-guard';

export async function GET() {
  const a = await requireInventoryAuth();
  if (isResponse(a)) return a;
  const forbidden = requireOwner(a);
  if (forbidden) return forbidden;
  try {
    return NextResponse.json({ logs: await listLogs() });
  } catch (e: any) {
    console.error('[api/inventory/logs] GET:', e?.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
