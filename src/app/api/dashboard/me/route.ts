import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { requireDashboardAuth } from '@/lib/dashboard/api-guard';

/** Paritas `GET /api/me` server.js — bentuk respons dipertahankan (§8.1). */
export async function GET() {
  const g = await requireDashboardAuth('me');
  if (!g.ok) return g.res;
  const cu = await currentUser();
  return NextResponse.json({
    username: g.user.username,
    role: g.user.role,
    name: g.user.name,
    tfaEnabled: !!(cu?.privateMetadata as Record<string, unknown>)?.totpEnabled
  });
}
