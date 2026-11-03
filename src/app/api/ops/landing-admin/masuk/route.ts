import { NextResponse } from 'next/server';
import { getAuthState } from '@/lib/core/auth';
import { writeAudit } from '@/lib/core/audit';
import { bolehBukaLandingAdmin, buatTokenSso, urlLandingAdmin } from '@/lib/landing-admin';

export const dynamic = 'force-dynamic';

// Dibuka lewat tautan target="_blank": tiket dibuat saat diklik (berlaku 60 detik), lalu browser dialihkan ke landing,
// yang menukarnya jadi sesi admin. Password admin landing tidak pernah lewat dashboard.
export async function GET() {
  const s = await getAuthState();
  // Sesi penuh: login + akun aktif + lolos 2FA bila aktif. Sisi Dashboard maupun Ops sama-sama sah.
  if (!s.signedIn || s.needsTotp || (!s.user && !s.dashboardUser)) {
    return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  }
  if (!bolehBukaLandingAdmin({ ops: s.user?.role, dashboard: s.dashboardUser?.role })) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  }
  const pelaku = (s.user ?? s.dashboardUser)!;

  let tujuan: string;
  try {
    const token = await buatTokenSso(process.env.LANDING_SSO_SECRET ?? '');
    tujuan = urlLandingAdmin(process.env.LANDING_ADMIN_URL, token);
  } catch (e: unknown) {
    console.error('[landing-admin]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Penghubung admin landing belum dikonfigurasi.' }, { status: 503 });
  }

  await writeAudit({
    requestId: crypto.randomUUID(),
    user: { username: pelaku.username, role: pelaku.role },
    moduleId: 'landing-admin',
    action: 'CREATE',
    target: 'Landing → sesi admin (SSO)',
    status: 'sukses',
  });

  const res = NextResponse.redirect(tujuan, 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}
