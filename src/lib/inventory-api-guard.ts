import { NextResponse } from 'next/server';
import { getSessionUser } from './core/auth';
import type { SessionUser } from './core/auth';

/**
 * Gerbang API Inventory. Padanan `getAuthenticatedUser()` app lama, tapi
 * identitasnya sesi Clerk repo ini — bukan tabel `users` DB Inventory.
 *
 * Role dipetakan ke dua tingkat app lama: owner/pengawas = OWNER (boleh
 * mengelola), sisanya STAFF (baca + catat pemakaian).
 */
export type InvRole = 'OWNER' | 'STAFF';

export interface InvAuth {
  user: SessionUser;
  role: InvRole;
}

export async function requireInventoryAuth(): Promise<InvAuth | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role: InvRole = user.role === 'owner' || user.role === 'pengawas' ? 'OWNER' : 'STAFF';
  return { user, role };
}

export function requireOwner(a: InvAuth): NextResponse | null {
  if (a.role !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden: Owner access required' }, { status: 403 });
  }
  return null;
}

export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse;
