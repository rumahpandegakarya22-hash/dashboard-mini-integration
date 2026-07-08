import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleAuthUrl } from '@/lib/google-oauth';

const STATE_COOKIE = 'miniapp_oauth_state';

/** Redirect ke consent screen Google. State CSRF disimpan di cookie sementara, dicek lagi di callback. */
export async function GET(_req: NextRequest) {
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildGoogleAuthUrl(state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
