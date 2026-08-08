import { NextResponse } from 'next/server';
import { listAlat, createAlat, updateAlat, seedAlatIfEmpty } from '@/lib/inventory-admin';
import { requireInventoryAuth, requireOwner, isResponse } from '@/lib/inventory-api-guard';

export async function GET() {
  const a = await requireInventoryAuth();
  if (isResponse(a)) return a;
  try {
    await seedAlatIfEmpty();
    const alat = await listAlat();
    return NextResponse.json({ alat });
  } catch (e: any) {
    console.error('[api/inventory/alat] GET:', e?.message);
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
    const id = await createAlat({
      nama: String(b.nama ?? ''),
      kategori: String(b.kategori ?? ''),
      kondisi: String(b.kondisi ?? 'Baru'),
      jumlah: parseInt(b.jumlah) || 1,
      catatan: String(b.catatan ?? ''),
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
    await updateAlat({
      id: Number(b.id),
      nama: String(b.nama ?? ''),
      kategori: String(b.kategori ?? ''),
      kondisi: String(b.kondisi ?? 'Baru'),
      jumlah: parseInt(b.jumlah) || 1,
      catatan: String(b.catatan ?? ''),
      by: a.user.username
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 400 });
  }
}
