import { NextResponse } from 'next/server';
import { listOpnames, getOpname, createOpname, saveOpname } from '@/lib/inventory-admin';
import { requireInventoryAuth, requireOwner, isResponse } from '@/lib/inventory-api-guard';

export async function GET(req: Request) {
  const a = await requireInventoryAuth();
  if (isResponse(a)) return a;
  const forbidden = requireOwner(a);
  if (forbidden) return forbidden;
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (id) {
      const data = await getOpname(Number(id));
      if (!data) return NextResponse.json({ error: 'Laporan opname tidak ditemukan' }, { status: 404 });
      return NextResponse.json(data);
    }
    return NextResponse.json({ opnames: await listOpnames() });
  } catch (e: any) {
    console.error('[api/inventory/opname] GET:', e?.message);
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
    const action = String(b.action ?? '');

    if (action === 'CREATE') {
      const id = await createOpname(String(b.period ?? ''), a.user.username);
      return NextResponse.json({ success: true, id });
    }

    if (action === 'SAVE_DRAFT' || action === 'FINALIZE') {
      const res = await saveOpname({
        opnameId: Number(b.opnameId),
        items: (Array.isArray(b.items) ? b.items : []).map((i: any) => ({
          materialId: Number(i.materialId),
          physicalStock: parseFloat(String(i.physicalStock).replace(',', '.')) || 0,
          notes: String(i.notes ?? '').trim()
        })),
        finalize: action === 'FINALIZE',
        by: a.user.username
      });
      return NextResponse.json({ success: true, ...res });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 400 });
  }
}
