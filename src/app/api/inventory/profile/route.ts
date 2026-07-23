import { NextResponse } from 'next/server';
import { requireInventoryAuth, isResponse } from '@/lib/inventory-api-guard';

/**
 * Padanan GET /api/auth/profile app lama — bentuk responsnya sengaja
 * dipertahankan ({ user: { name, role } }) supaya halaman hasil port tidak
 * perlu diubah. Sumbernya sesi Clerk repo ini, bukan tabel users DB Inventory.
 */
export async function GET() {
  const a = await requireInventoryAuth();
  if (isResponse(a)) return a;
  return NextResponse.json({ user: { name: a.user.name || a.user.username, role: a.role } });
}
