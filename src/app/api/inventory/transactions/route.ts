import { NextResponse } from 'next/server';
import { postUsage, postPurchase } from '@/lib/inventory';
import { listTransactions, postCorrection } from '@/lib/inventory-admin';
import { requireInventoryAuth, requireOwner, isResponse } from '@/lib/inventory-api-guard';

export async function GET(req: Request) {
  const a = await requireInventoryAuth();
  if (isResponse(a)) return a;
  try {
    const sp = new URL(req.url).searchParams;
    const transactions = await listTransactions({
      type: sp.get('type') || undefined,
      search: sp.get('search') || undefined,
      from: sp.get('from') || undefined,
      to: sp.get('to') || undefined
    });
    return NextResponse.json({ transactions });
  } catch (e: any) {
    console.error('[api/inventory/transactions] GET:', e?.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/** PURCHASE / USAGE / CORRECTION — padanan POST /api/transactions app lama. */
export async function POST(req: Request) {
  const a = await requireInventoryAuth();
  if (isResponse(a)) return a;
  try {
    const b = await req.json();
    const type = String(b.type ?? '');
    const materialId = Number(b.materialId);
    const quantity = parseFloat(String(b.quantity).replace(',', '.'));
    const notes = String(b.notes ?? '').trim();
    const by = a.user.username;

    if (!materialId || !type) {
      return NextResponse.json({ error: 'Bahan dan tipe mutasi wajib diisi' }, { status: 400 });
    }

    if (type === 'PURCHASE') {
      const forbidden = requireOwner(a);
      if (forbidden) return forbidden;
      const res = await postPurchase({
        materialId,
        quantity,
        totalPrice: parseFloat(String(b.totalPrice ?? '0').replace(/[^\d.]/g, '')) || 0,
        purchaseDate: String(b.purchaseDate || new Date().toISOString().slice(0, 10)),
        notes: `${by}${notes ? ` — ${notes}` : ''}`
      });
      return NextResponse.json({ success: true, ...res });
    }

    if (type === 'USAGE') {
      const res = await postUsage({
        materialId,
        quantity,
        notes: `${by}${notes ? ` — ${notes}` : ''}`,
        batchId: b.batchId ? Number(b.batchId) : null
      });
      return NextResponse.json({ success: true, ...res });
    }

    if (type === 'CORRECTION') {
      const forbidden = requireOwner(a);
      if (forbidden) return forbidden;
      const res = await postCorrection({
        materialId,
        physicalStock: quantity, // koreksi: quantity = saldo tujuan, verbatim app lama
        reason: notes || '-',
        by
      });
      return NextResponse.json({ success: true, ...res });
    }

    return NextResponse.json({ error: 'Tipe transaksi tidak dikenal' }, { status: 400 });
  } catch (e: any) {
    console.error('[api/inventory/transactions] POST:', e?.message);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 400 });
  }
}
