import { NextResponse } from 'next/server';
import { listBatches } from '@/lib/inventory-admin';
import { requireInventoryAuth, isResponse } from '@/lib/inventory-api-guard';

export async function GET(req: Request) {
  const a = await requireInventoryAuth();
  if (isResponse(a)) return a;
  try {
    const sp = new URL(req.url).searchParams;
    const materialId = sp.get('materialId');
    const batches = await listBatches(materialId ? Number(materialId) : undefined, sp.get('all') === '1');
    return NextResponse.json({ batches });
  } catch (e: any) {
    console.error('[api/inventory/batches] GET:', e?.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
