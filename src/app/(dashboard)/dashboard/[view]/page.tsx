import { notFound, redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { DEFAULT_PERIOD, canOpenView, findPage } from '@/config/dashboard-nav';
import DashboardShell from '@/components/dashboard/DashboardShell';

/**
 * Halaman data per role. `config/dashboard-nav.ts` adalah sumber tunggal untuk
 * sidebar SEKALIGUS guard: view yang tidak terdaftar untuk role pemanggil → 404,
 * jadi tidak ada halaman yang bocor lewat URL tebakan (§8.2).
 *
 * Isi tiap view di-port pada langkah 4 Fase 4.
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

  return (
    <DashboardShell
      role={user.role}
      userName={user.name || user.username}
      tfaEnabled={s.totpEnrolled}
      view={view}
      crumb={page.crumb}
      isDash={page.group === 'dash'}
      period={sp.period || DEFAULT_PERIOD}
      from={sp.from}
      to={sp.to}
    >
      <section className="card" style={{ padding: 20 }}>
        <div className="card__title">{page.label}</div>
        <p>Konten halaman ini di-port pada langkah 4 Fase 4.</p>
      </section>
    </DashboardShell>
  );
}
