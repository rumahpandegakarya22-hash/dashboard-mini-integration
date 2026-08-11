import Link from 'next/link';
import { ChevronLeft, Globe, ShieldAlert } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import LandingPageAdmin from './LandingPageAdmin';

const ALLOWED = ['owner', 'pengawas', 'staff_admin', 'staff_marketing'];

export default async function AdminLandingPage() {
  const user = await getSessionUser();
  if (!user) return null;

  if (!ALLOWED.includes(user.role)) {
    return (
      <div className="card success-card">
        <span className="icon-tile lg danger" aria-hidden>
          <ShieldAlert size={26} />
        </span>
        <h2>Tidak punya akses</h2>
        <p className="muted">Halaman ini hanya bisa diakses oleh Owner, Admin, dan Marketing.</p>
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
          <Globe size={24} />
        </span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Landing Page</h1>
          <p className="page-head-sub">Kelola konten yang ditampilkan di website</p>
        </div>
      </header>
      <LandingPageAdmin />
    </>
  );
}
