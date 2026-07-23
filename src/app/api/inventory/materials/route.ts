import { NextResponse } from 'next/server';
import { listMaterials, createMaterial, updateMaterial } from '@/lib/inventory-admin';
import { requireInventoryAuth, requireOwner, isResponse } from '@/lib/inventory-api-guard';

export async function GET(req: Request) {
  const a = await requireInventoryAuth();
  if (isResponse(a)) return a;
  try {
    const search = (new URL(req.url).searchParams.get('search') || '').toLowerCase();
    const all = await listMaterials();
    const materials = search
      ? all.filter(
          (m) => m.name.toLowerCase().includes(search) || m.category.toLowerCase().includes(search)
        )
      : all;
    return NextResponse.json({ materials });
  } catch (e: any) {
    console.error('[api/inventory/materials] GET:', e?.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const a = await requireInventoryAuth();
  if (isResponse(a)) return a;
  const forbidden = requireOwner(a);
  if (forbidden) return forbidden;
  try {
    const b = await req.json();
    const id = await createMaterial({
      name: String(b.name ?? ''),
      category: String(b.category ?? ''),
      unit: String(b.unit ?? ''),
      currentStock: parseFloat(b.currentStock) || 0,
      minStock: parseFloat(b.minStock) || 0,
      by: a.user.username
    });
    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const a = await requireInventoryAuth();
  if (isResponse(a)) return a;
  const forbidden = requireOwner(a);
  if (forbidden) return forbidden;
  try {
    const b = await req.json();
    await updateMaterial({
      id: Number(b.id),
      name: String(b.name ?? ''),
      category: String(b.category ?? ''),
      unit: String(b.unit ?? ''),
      minStock: parseFloat(b.minStock) || 0,
      by: a.user.username
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 400 });
  }
}
