import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { DEFAULT_PERIOD } from '@/config/dashboard-nav';
import DashboardShell from '@/components/dashboard/DashboardShell';
import TotpSettings from '@/components/TotpSettings';
import UnifiedUserAdmin from '@/components/dashboard/UnifiedUserAdmin';


export default async function DashboardAkunPage({
  searchParams
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const s = await getAuthState();
  if (!s.dashboardUser) redirect('/pending');

  const sp = await searchParams;
  const user = s.dashboardUser;
  const period = sp.period || DEFAULT_PERIOD;

  return (
    <DashboardShell
      role={user.role}
      userName={user.name || user.username}
      tfaEnabled={s.totpEnrolled}
      hasOpsAccess={!!s.user}
      view="akun"
      crumb="Akun & Keamanan"
      period={period}
      from={sp.from}
      to={sp.to}
    >
      <section className="view">
        <h2 className="section-title">AKUN &amp; KEAMANAN</h2>

        <div className="sec-card">
          <h3>
            Autentikasi Dua Faktor <small>(Google Authenticator)</small>
          </h3>
          <p className="muted" style={{ marginBottom: 10 }}>
            Satu kali scan QR berlaku untuk Dashboard maupun Mini App Operasional.
          </p>
          <TotpSettings initialEnrolled={s.totpEnrolled} />
        </div>

        {user.role === 'owner' && <UnifiedUserAdmin />}
      </section>
    </DashboardShell>
  );
}
