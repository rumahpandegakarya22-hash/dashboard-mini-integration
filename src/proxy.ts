import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Gerbang kasar: hanya memastikan ADA sesi Clerk. Gating halus (status
// pending/disabled, role, step-up 2FA) dilakukan di (app)/layout.tsx dan
// getSessionUser() per API route — butuh Backend API, bukan urusan proxy.
const isPublicRoute = createRouteMatcher(['/login(.*)', '/sign-up(.*)', '/api/webhooks/clerk']);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();

  const { userId } = await auth();
  if (!userId) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)']
};
