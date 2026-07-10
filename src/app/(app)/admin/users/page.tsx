import { cookies } from 'next/headers';
import Link from 'next/link';
import { ChevronLeft, ShieldAlert, Users } from 'lucide-react';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import UserAdminPanel from '@/components/UserAdminPanel';

export default async function AdminUsersPage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return null; // proxy.ts sudah redirect ke /login

  if (user.role !== 'owner') {
    return (
      <div className="card success-card">
        <span className="icon-tile lg danger" aria-hidden>
          <ShieldAlert size={26} />
        </span>
        <h2>Hanya untuk Owner</h2>
        <p className="muted">Halaman kelola user hanya bisa diakses akun Owner.</p>
        <Link className="btn-plain" href="/">
          <ChevronLeft size={18} />
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden>
          <Users size={24} />
        </span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Kelola User</h1>
          <p className="page-head-sub">Approve akun baru, atur role, nonaktifkan akses</p>
        </div>
      </header>
      <UserAdminPanel currentUsername={user.username} />
    </>
  );
}
