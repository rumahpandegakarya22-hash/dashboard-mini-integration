import Link from 'next/link';
import { ChevronLeft, ShieldAlert, User } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import PenghuniPanel from '@/components/PenghuniPanel';

export default async function AdminPenghuniPage() {
  const user = await getSessionUser();
  if (!user) return null;

  if (user.role !== 'owner' && user.role !== 'staff_admin') {
    return (
      <div className="card success-card">
        <span className="icon-tile lg danger" aria-hidden>
          <ShieldAlert size={26} />
        </span>
        <h2>Tidak punya akses</h2>
        <p className="muted">Halaman ini hanya bisa diakses Owner dan Staff Admin.</p>
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
          <User size={24} />
        </span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Ubah Data Penghuni</h1>
          <p className="page-head-sub">Klik kartu penghuni untuk edit data</p>
        </div>
      </header>
      <PenghuniPanel />
    </>
  );
}
