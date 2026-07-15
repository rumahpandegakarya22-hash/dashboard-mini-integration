import { getSessionUser } from '@/lib/auth';
import { canAccess, ROLE_LABEL } from '@/lib/roles';
import { MODULES } from '@/lib/modules/registry';
import HomeMenu from '@/components/HomeMenu';

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) return null; // (app)/layout sudah redirect

  const visible = MODULES.filter((m) => canAccess(user.role, m.id)).map((m) => ({ id: m.id, title: m.title }));

  return (
    <HomeMenu userName={user.name} roleLabel={ROLE_LABEL[user.role]} isOwner={user.role === 'owner'} modules={visible} />
  );
}
