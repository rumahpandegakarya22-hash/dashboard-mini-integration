import { cookies } from 'next/headers';
import Link from 'next/link';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { canAccess, ROLE_LABEL } from '@/lib/roles';
import { MODULES } from '@/lib/modules/registry';
import LogoutButton from './logout-button';

export default async function HomePage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return null; // proxy.ts sudah redirect

  const visible = MODULES.filter((m) => canAccess(user.role, m.id));

  return (
    <>
      <div className="topbar">
        <div>
          <h1 style={{ margin: 0 }}>Halo, {user.name}</h1>
          <span className="muted">{ROLE_LABEL[user.role]}</span>
        </div>
        <LogoutButton />
      </div>
      <div className="menu">
        {visible.map((m) => (
          <Link key={m.id} href={`/m/${m.id}`}>
            {m.icon} {m.title}
          </Link>
        ))}
        {visible.length === 0 && <p className="muted">Tidak ada modul untuk role ini.</p>}
        {user.role === 'owner' && <Link href="/admin/users">👤 Kelola User</Link>}
      </div>
    </>
  );
}
