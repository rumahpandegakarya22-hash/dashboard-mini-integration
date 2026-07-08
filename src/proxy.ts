import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, maybeRefresh, COOKIE_NAME } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/google', '/pending'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Sliding session 72 jam
  const res = NextResponse.next();
  const fresh = token ? await maybeRefresh(token) : null;
  if (fresh) {
    res.cookies.set(COOKIE_NAME, fresh, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 72 * 3600, path: '/' });
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)']
};
