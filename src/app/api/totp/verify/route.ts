import { NextRequest, NextResponse } from 'next/server';
import { getClerkSessionUser, issueStepupCookie } from '@/lib/auth';
import { verifyTotpCode } from '@/lib/totp';
import { rateLimitOk } from '@/lib/redis';

/** Verifikasi TOTP saat login (step-up): kode benar → cookie step-up 12 jam utk sesi ini. */
export async function POST(req: NextRequest) {
  const sess = await getClerkSessionUser();
  if (!sess) return NextResponse.json({ error: 'Belum login / akun belum aktif.' }, { status: 401 });
  if (!(await rateLimitOk(`totp:verify:${sess.user.id}`, 10, 300))) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan. Tunggu beberapa menit.' }, { status: 429 });
  }

  const priv = sess.user.privateMetadata as Record<string, unknown>;
  if (!priv?.totpEnabled || typeof priv?.totpSecret !== 'string') {
    return NextResponse.json({ error: '2FA tidak aktif untuk akun ini.' }, { status: 400 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!verifyTotpCode(priv.totpSecret, code || '')) {
    return NextResponse.json({ error: 'Kode salah atau kedaluwarsa. Coba lagi.' }, { status: 400 });
  }

  await issueStepupCookie(sess.sessionId);
  return NextResponse.json({ ok: true });
}
