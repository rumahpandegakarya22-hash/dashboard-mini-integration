import { notFound, redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { DEFAULT_PERIOD, canOpenView, findPage } from '@/config/dashboard-nav';
import { loadDashboardData } from '@/lib/dashboard/views/load';
import DashboardShell from '@/components/dashboard/DashboardShell';
import OverviewFor, { type OverviewKey } from '@/components/dashboard/overviews/OverviewFor';
import ViewFor from '@/components/dashboard/pages/ViewFor';

/**
 * Halaman per view. `config/dashboard-nav.ts` adalah sumber tunggal untuk
 * sidebar SEKALIGUS guard: view yang tidak terdaftar untuk role pemanggil → 404,
 * jadi tidak ada halaman yang bocor lewat URL tebakan (§8.2).
 *
 * View bergrup "dash" (Owner: sales/marketing/admin/operasional) merender
 * overview divisi terkait — sama seperti properti `render:` objek ROLES lama.
 * View bergrup "page" (tabel data) di-port pada bagian berikutnya langkah 4.
 */
export default async function DashboardViewPage({
  params,
  searchParams
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const s = await getAuthState();
  if (!s.dashboardUser) redirect('/pending');

  const { view } = await params;
  const sp = await searchParams;
  const user = s.dashboardUser;

  if (!canOpenView(user.role, view)) notFound();
  const page = findPage(user.role, view)!;
  const period = sp.period || DEFAULT_PERIOD;

  const loaded = await loadDashboardData(user.role, period, sp.from, sp.to, {
    withInventory: view === 'stok'
  });
  const isDash = page.group === 'dash';

  return (
    <DashboardShell
      role={user.role}
      userName={user.name || user.username}
      tfaEnabled={s.totpEnrolled}
      hasOpsAccess={!!s.user}
      view={view}
      crumb={page.crumb}
      isDash={isDash}
      period={period}
      from={sp.from}
      to={sp.to}
    >
      {isDash ? (
        <OverviewFor which={view as OverviewKey} loaded={loaded} period={period} from={sp.from} to={sp.to} />
      ) : (
        <ViewFor view={view} role={user.role} loaded={loaded} period={period} />
      )}
    </DashboardShell>
  );
}
