import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCode, verifyGoogleIdToken } from '@/lib/google-oauth';
import { findOrCreateGoogleUser, createToken, COOKIE_NAME } from '@/lib/auth';

const STATE_COOKIE = 'miniapp_oauth_state';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  const loginUrl = new URL('/login', url.origin);

  if (!code || !state || !cookieState || state !== cookieState) {
    loginUrl.searchParams.set('error', 'Google login gagal (state tidak cocok). Coba lagi.');
    return NextResponse.redirect(loginUrl);
  }

  try {
    const idToken = await exchangeGoogleCode(code);
    const profile = await verifyGoogleIdToken(idToken);
    const { user, isNew } = await findOrCreateGoogleUser({
      email: profile.email,
      name: profile.name,
      googleId: profile.sub
    });

    if (isNew || user.status === 'pending') {
      const res = NextResponse.redirect(new URL('/pending', url.origin));
      res.cookies.delete(STATE_COOKIE);
      return res;
    }
    if (user.status === 'disabled') {
      loginUrl.searchParams.set('error', 'Akun ini sudah dinonaktifkan Owner. Hubungi Owner.');
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete(STATE_COOKIE);
      return res;
    }
    if (!user.role) {
      // status aktif tapi role belum ditetapkan — seharusnya tidak terjadi, tapi jaga-jaga.
      const res = NextResponse.redirect(new URL('/pending', url.origin));
      res.cookies.delete(STATE_COOKIE);
      return res;
    }

    const token = await createToken({ username: profile.email.toLowerCase(), name: user.name, role: user.role });
    const res = NextResponse.redirect(new URL('/', url.origin));
    res.cookies.set(COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 72 * 3600, path: '/' });
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (e: any) {
    loginUrl.searchParams.set('error', e?.message || 'Google login gagal.');
    return NextResponse.redirect(loginUrl);
  }
}
