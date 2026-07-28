import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, SECURITY_HEADERS } from '@/lib/core/csp';

// Gerbang kasar: hanya memastikan ADA sesi Clerk. Gating halus (status
// pending/disabled, role, step-up 2FA) dilakukan di layout tiap route group
// ((ops)/layout.tsx, (dashboard)/layout.tsx) dan getSessionUser() per API
// route — butuh Backend API, bukan urusan proxy.
const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/sign-up(.*)',
  '/api/webhooks/clerk',
  '/api/health'
]);

/**
 * CSP dipasang di sini, BUKAN di next.config.mjs headers().
 *
 * Next menyuntik inline <script> untuk hydration. CSP statis tidak bisa memberi
 * nonce ke script itu, sehingga terblokir `script-src-elem` dan React tidak
 * pernah hydrate — halaman blank total di produksi (dev lolos karena di sana
 * 'unsafe-inline' memang diizinkan untuk HMR). Nonce per-request menutup celah
 * itu tanpa melonggarkan CSP.
 */
function prepare(req: NextRequest): string {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildCsp(nonce);
  // Next membaca nonce dari header REQUEST untuk menandai script bawaannya.
  req.headers.set('x-nonce', nonce);
  req.headers.set('Content-Security-Policy', csp);
  return csp;
}

/** Pasang CSP + header keamanan ke response. */
function seal(res: NextResponse, csp: string): NextResponse {
  res.headers.set('Content-Security-Policy', csp);
  for (const [k, v] of SECURITY_HEADERS) res.headers.set(k, v);
  return res;
}

export const proxy = clerkMiddleware(async (auth, req) => {
  const csp = prepare(req);
  const pass = () => seal(NextResponse.next({ request: { headers: req.headers } }), csp);

  if (isPublicRoute(req)) return pass();

  // Bypass login lokal — syarat sama persis dengan bypassDev() di lib/core/auth.ts.
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === '1') return pass();

  const { userId } = await auth();
  if (!userId) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return seal(NextResponse.json({ error: 'Belum login.' }, { status: 401 }), csp);
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return seal(NextResponse.redirect(url), csp);
  }
  return pass();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)']
};
