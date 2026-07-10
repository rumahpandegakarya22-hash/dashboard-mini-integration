import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { canAccess, ROLE_LABEL } from '@/lib/roles';
import { MODULES } from '@/lib/modules/registry';
import HomeMenu from '@/components/HomeMenu';

export default async function HomePage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return null; // proxy.ts sudah redirect

  const visible = MODULES.filter((m) => canAccess(user.role, m.id)).map((m) => ({ id: m.id, title: m.title }));

  return (
    <HomeMenu userName={user.name} roleLabel={ROLE_LABEL[user.role]} isOwner={user.role === 'owner'} modules={visible} />
  );
}
