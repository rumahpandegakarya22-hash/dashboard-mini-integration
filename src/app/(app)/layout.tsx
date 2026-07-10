import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { canAccess, ROLE_LABEL } from '@/lib/roles';
import { MODULES } from '@/lib/modules/registry';
import AppShell from '@/components/AppShell';

/** Layout halaman ber-login: chrome adaptif (top bar + dock di mobile, sidebar di desktop). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return null; // proxy.ts sudah redirect ke /login

  const visible = MODULES.filter((m) => canAccess(user.role, m.id)).map((m) => ({ id: m.id, title: m.title }));

  return (
    <AppShell userName={user.name} roleLabel={ROLE_LABEL[user.role]} isOwner={user.role === 'owner'} modules={visible}>
      {children}
    </AppShell>
  );
}
