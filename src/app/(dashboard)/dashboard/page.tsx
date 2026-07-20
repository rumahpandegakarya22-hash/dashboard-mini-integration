import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { DEFAULT_PERIOD, findPage } from '@/config/dashboard-nav';
import { loadDashboardData } from '@/lib/dashboard/views/load';
import DashboardShell from '@/components/dashboard/DashboardShell';
import OverviewFor from '@/components/dashboard/overviews/OverviewFor';

/** Overview per role — halaman default `/dashboard`. */
export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const s = await getAuthState();
  if (!s.dashboardUser) redirect('/pending');

  const sp = await searchParams;
  const user = s.dashboardUser;
  const period = sp.period || DEFAULT_PERIOD;
  const page = findPage(user.role, 'overview')!;

  const loaded = await loadDashboardData(user.role, period, sp.from, sp.to);

  return (
    <DashboardShell
      role={user.role}
      userName={user.name || user.username}
      tfaEnabled={s.totpEnrolled}
      view="overview"
      crumb={page.crumb}
      isDash
      period={period}
      from={sp.from}
      to={sp.to}
    >
      <OverviewFor which={user.role} loaded={loaded} period={period} from={sp.from} to={sp.to} />
    </DashboardShell>
  );
}
