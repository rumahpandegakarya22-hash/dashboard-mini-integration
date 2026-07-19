import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboard/api-guard';
import { readInventory, isInventoryConfigured } from '@/lib/dashboard/inventory';

/** Paritas `GET /api/inventory` server.js: monitoring stok (read-only). */
export async function GET() {
  const g = await requireDashboardAuth('inventory');
  if (!g.ok) return g.res;
  if (!isInventoryConfigured()) return NextResponse.json({ configured: false });
  try {
    const data = await readInventory();
    return NextResponse.json({ configured: true, ...data });
  } catch (e) {
    console.error('[api/dashboard/inventory] gagal baca DB inventory:', e);
    return NextResponse.json({ configured: true, error: 'Terjadi kesalahan pada server.' }, { status: 502 });
  }
}
