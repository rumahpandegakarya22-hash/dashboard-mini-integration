import { cookies } from 'next/headers';
import Link from 'next/link';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import UserAdminPanel from '@/components/UserAdminPanel';

export default async function AdminUsersPage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return null; // proxy.ts sudah redirect ke /login

  if (user.role !== 'owner') {
    return (
      <>
        <div className="topbar">
          <h1>Kelola User</h1>
        </div>
        <p className="error">Halaman ini hanya untuk Owner.</p>
        <Link className="btn-link" href="/">
          ← Kembali ke menu
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <h1>Kelola User</h1>
      </div>
      <UserAdminPanel currentUsername={user.username} />
      <Link className="btn-link" href="/">
        ← Kembali ke menu
      </Link>
    </>
  );
}
