import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getClerkSessionUser, issueStepupCookie } from '@/lib/auth';
import { verifyTotpCode } from '@/lib/totp';
import { rateLimitOk } from '@/lib/redis';

/** Konfirmasi pendaftaran 2FA: verifikasi kode dari pending secret → aktifkan. */
export async function POST(req: NextRequest) {
  const sess = await getClerkSessionUser();
  if (!sess) return NextResponse.json({ error: 'Belum login / akun belum aktif.' }, { status: 401 });
  if (!(await rateLimitOk(`totp:enable:${sess.user.id}`, 10, 300))) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan. Tunggu beberapa menit.' }, { status: 429 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const pending = (sess.user.privateMetadata as Record<string, unknown>)?.totpPendingSecret;
  if (typeof pending !== 'string' || !pending) {
    return NextResponse.json({ error: 'Mulai setup 2FA terlebih dahulu.' }, { status: 400 });
  }
  if (!verifyTotpCode(pending, code || '')) {
    return NextResponse.json({ error: 'Kode salah atau kedaluwarsa. Coba lagi.' }, { status: 400 });
  }

  const client = await clerkClient();
  await client.users.updateUserMetadata(sess.user.id, {
    privateMetadata: { totpSecret: pending, totpEnabled: true, totpPendingSecret: null }
  });
  // Sudah membuktikan penguasaan authenticator → langsung step-up utk sesi ini.
  await issueStepupCookie(sess.sessionId);
  return NextResponse.json({ ok: true });
}
