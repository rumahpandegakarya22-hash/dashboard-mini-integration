import { NextResponse } from 'next/server';

/**
 * Padanan GET /api/health Express Dashboard (§8.1).
 * Public route di proxy.ts — dipakai untuk pemantauan uptime saat cutover (§9 Fase 6).
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
