/* =========================================================================
   Gerbang auth + rate limit untuk Route Handler sisi Dashboard.

   Padanan `requireAuth` / `requireOwner` / `dataLimiter` di server.js Express
   lama (§8.1). Bentuk & teks pesan error dipertahankan agar kontrak API tidak
   berubah dari sudut pandang klien.

   Perbedaan sadar: rate limit memakai Upstash Redis (lib/core/redis), bukan
   `express-rate-limit` in-memory yang tidak andal di serverless (§1.3).
   ========================================================================= */

import { NextResponse } from 'next/server';
import { getAuthState, type DashboardSessionUser } from '@/lib/core/auth';
import { rateLimitOk } from '@/lib/core/redis';

export type GuardResult = { ok: true; user: DashboardSessionUser } | { ok: false; res: NextResponse };

/**
 * Padanan requireAuth: sesi Clerk + status active + role dashboard valid +
 * lolos step-up 2FA bila 2FA aktif. Status code dipertahankan dari server.js:
 *   401 belum login · 403 pending/disabled/tanpa role · 401+totpRequired bila 2FA belum
 */
export async function requireDashboardAuth(limiterKey?: string): Promise<GuardResult> {
  const s = await getAuthState();

  if (!s.signedIn) {
    return { ok: false, res: NextResponse.json({ error: 'Belum login' }, { status: 401 }) };
  }
  if (s.dashboardStatus === 'pending') {
    return { ok: false, res: NextResponse.json({ error: 'Akun belum disetujui Owner' }, { status: 403 }) };
  }
  if (s.dashboardStatus === 'disabled') {
    return { ok: false, res: NextResponse.json({ error: 'Akun dinonaktifkan' }, { status: 403 }) };
  }
  if (!s.dashboardRole) {
    return { ok: false, res: NextResponse.json({ error: 'Akun belum memiliki role' }, { status: 403 }) };
  }
  if (s.needsTotp) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'Verifikasi 2FA diperlukan', totpRequired: true }, { status: 401 })
    };
  }
  if (!s.dashboardUser) {
    return { ok: false, res: NextResponse.json({ error: 'Akun belum memiliki role' }, { status: 403 }) };
  }

  // Padanan dataLimiter server.js: 120 permintaan / 60 detik, per user.
  if (limiterKey && !(await rateLimitOk(`dash:${limiterKey}:${s.dashboardUser.id}`, 120, 60))) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar.' }, { status: 429 })
    };
  }

  return { ok: true, user: s.dashboardUser };
}

/** Padanan requireOwner — dipakai setelah requireDashboardAuth. */
export function requireOwner(user: DashboardSessionUser): NextResponse | null {
  if (user.role !== 'owner') {
    return NextResponse.json({ error: 'Hanya Owner yang diizinkan' }, { status: 403 });
  }
  return null;
}
