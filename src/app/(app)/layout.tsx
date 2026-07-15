import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/auth';
import { canAccess, ROLE_LABEL } from '@/lib/roles';
import { MODULES } from '@/lib/modules/registry';
import AppShell from '@/components/AppShell';

/**
 * Layout halaman ber-login. Urutan gerbang: login Clerk (proxy.ts) →
 * step-up 2FA (/2fa) → approval Owner (/pending) → app.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getAuthState();
  if (!s.signedIn) redirect('/login');
  if (s.needsTotp) redirect('/2fa');
  if (!s.user) redirect('/pending'); // pending / disabled / belum punya role

  const user = s.user;
  const visible = MODULES.filter((m) => canAccess(user.role, m.id)).map((m) => ({ id: m.id, title: m.title }));

  return (
    <AppShell userName={user.name} roleLabel={ROLE_LABEL[user.role]} isOwner={user.role === 'owner'} modules={visible}>
      {children}
    </AppShell>
  );
}
