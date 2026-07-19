import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';

/**
 * Layout route group Dashboard — gating namespace `role`/`status` (§5.2).
 * Urutan gerbang sama dgn (ops): login Clerk → step-up 2FA → approval → app.
 *
 * `data-app="dashboard"` akan mengikat token theme-dashboard.css ke subtree ini
 * (§4). File tema itu dibuat di Fase 4; sampai saat itu wrapper sudah terpasang
 * supaya struktur & gating bisa diuji lebih dulu.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await getAuthState();
  if (!s.signedIn) redirect('/login');
  if (s.needsTotp) redirect('/2fa');
  if (!s.dashboardUser) redirect('/pending'); // pending / disabled / belum punya role dashboard

  // `data-role` di wrapper: styles.css lama memakai body[data-role="owner"]
  // untuk aksen palet Owner; selector itu dipetakan ke wrapper ini saat port.
  return (
    <div data-app="dashboard" data-role={s.dashboardUser.role}>
      {children}
    </div>
  );
}
