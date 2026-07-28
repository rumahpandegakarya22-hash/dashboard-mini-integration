import Link from 'next/link';
import { ChevronLeft, ShieldAlert, UsersRound } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import AkunPenghuniPanel from '@/components/AkunPenghuniPanel';

export default async function AdminAkunPenghuniPage() {
  const user = await getSessionUser();
  if (!user) return null; // (ops)/layout sudah redirect ke /login

  if (user.role !== 'owner' && user.role !== 'staff_admin') {
    return (
      <div className="card success-card">
        <span className="icon-tile lg danger" aria-hidden>
          <ShieldAlert size={26} />
        </span>
        <h2>Tidak punya akses</h2>
        <p className="muted">Akun penghuni hanya bisa dikelola Owner dan Staff Admin.</p>
        <Link className="btn-plain" href="/ops">
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
          <UsersRound size={24} />
        </span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Akun Teman Rara</h1>
          <p className="page-head-sub">Cegah akun ganda per kamar &amp; akun eks-penghuni yang belum dicabut</p>
        </div>
      </header>
      <AkunPenghuniPanel />
    </>
  );
}
