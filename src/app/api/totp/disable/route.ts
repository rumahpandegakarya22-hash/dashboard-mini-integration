import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { getAuthState, getClerkSessionUser, STEPUP_COOKIE, LEGACY_STEPUP_COOKIE } from '@/lib/core/auth';
import { verifyTotpCode } from '@/lib/core/totp';
import { rateLimitOk } from '@/lib/core/redis';

/** Matikan 2FA: wajib auth PENUH (termasuk step-up) + kode TOTP valid sekali lagi. */
export async function POST(req: NextRequest) {
  // Aktif di salah satu sisi sudah cukup — 2FA melayani Dashboard & Ops sekaligus,
  // jadi pengguna dashboard-only pun harus bisa mematikannya.
  const s = await getAuthState();
  const sess = await getClerkSessionUser();
  const user = s.needsTotp ? null : s.user || s.dashboardUser;
  if (!user || !sess) return NextResponse.json({ error: 'Belum login / verifikasi 2FA dulu.' }, { status: 401 });
  if (!(await rateLimitOk(`totp:disable:${user.id}`, 10, 300))) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan. Tunggu beberapa menit.' }, { status: 429 });
  }

  const priv = sess.user.privateMetadata as Record<string, unknown>;
  if (!priv?.totpEnabled || typeof priv?.totpSecret !== 'string') {
    return NextResponse.json({ error: '2FA memang belum aktif.' }, { status: 400 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!verifyTotpCode(priv.totpSecret, code || '')) {
    return NextResponse.json({ error: 'Kode salah atau kedaluwarsa. Coba lagi.' }, { status: 400 });
  }

  const client = await clerkClient();
  await client.users.updateUserMetadata(user.id, {
    privateMetadata: { totpSecret: null, totpEnabled: false, totpPendingSecret: null }
  });
  // Paritas server.js lama: res.clearCookie(TOTP_COOKIE) setelah 2FA dimatikan.
  const jar = await cookies();
  jar.delete(STEPUP_COOKIE);
  jar.delete(LEGACY_STEPUP_COOKIE);
  return NextResponse.json({ ok: true, tfaEnabled: false });
}
