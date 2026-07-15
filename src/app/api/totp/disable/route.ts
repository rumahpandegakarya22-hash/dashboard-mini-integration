import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getSessionUser, getClerkSessionUser } from '@/lib/auth';
import { verifyTotpCode } from '@/lib/totp';
import { rateLimitOk } from '@/lib/redis';

/** Matikan 2FA: wajib auth PENUH (termasuk step-up) + kode TOTP valid sekali lagi. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  const sess = await getClerkSessionUser();
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
  return NextResponse.json({ ok: true });
}
