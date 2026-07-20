import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { DEFAULT_PERIOD, findPage } from '@/config/dashboard-nav';
import DashboardShell from '@/components/dashboard/DashboardShell';

/** Overview per role. Konten overview-nya sendiri di-port pada langkah 4 Fase 4. */
export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const s = await getAuthState();
  if (!s.dashboardUser) redirect('/pending');
  const sp = await searchParams;
  const user = s.dashboardUser;
  const page = findPage(user.role, 'overview')!;

  return (
    <DashboardShell
      role={user.role}
      userName={user.name || user.username}
      tfaEnabled={s.totpEnrolled}
      view="overview"
      crumb={page.crumb}
      isDash
      period={sp.period || DEFAULT_PERIOD}
      from={sp.from}
      to={sp.to}
    >
      <section className="card" style={{ padding: 20 }}>
        <div className="card__title">Overview {user.role}</div>
        <p>
          Shell, tema, chart, dan tabel sudah aktif. Konten overview per role di-port pada langkah 4 Fase 4
          (fungsi <code>*Overview()</code> di app.js → <code>lib/dashboard/views/</code> + komponen).
        </p>
      </section>
    </DashboardShell>
  );
}
