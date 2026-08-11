import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { guardOps } from '@/lib/core/routing';
import { canAccess, ROLE_LABEL } from '@/lib/core/roles';
import { MODULES } from '@/lib/modules/registry';
import AppShell from '@/components/AppShell';

/**
 * Layout route group Ops. Urutan gerbang: login Clerk (proxy.ts) →
 * step-up 2FA (/2fa) → approval Owner (/pending) → app.
 *
 * `data-app="ops"` mengikat seluruh token visual theme-ops.css ke subtree ini
 * (§4): dashboard memakai wrapper sendiri, sehingga kedua tema tidak pernah
 * bocor silang meski memakai nama token yang sama.
 */
export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const s = await getAuthState();
  const gate = guardOps(s);
  if (gate !== true) redirect(gate);

  const user = s.user!;
  const visible = MODULES.filter((m) => canAccess(user.role, m.id)).map((m) => ({ id: m.id, title: m.title }));

  return (
    <div data-app="ops">
      <AppShell userName={user.name} roleLabel={ROLE_LABEL[user.role]} isOwner={user.role === 'owner'}
        canKelola={user.role === 'owner' || user.role === 'staff_admin'}
        canLandingPage={user.role === 'owner' || user.role === 'staff_admin' || user.role === 'staff_marketing'}
        canRiwayatBayar={user.role === 'owner' || user.role === 'staff_admin' || user.role === 'staff_sales'}
        canInspeksi={user.role === 'owner' || user.role === 'staff_admin' || user.role === 'staff_inspeksi'}
        hasDashboardAccess={!!s.dashboardUser} modules={visible}>
        {children}
      </AppShell>
    </div>
  );
}
