import Link from 'next/link';
import { ChevronLeft, Gavel, ShieldAlert } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import JenisPelanggaranPanel from '@/components/JenisPelanggaranPanel';

export default async function AdminJenisPelanggaranPage() {
  const user = await getSessionUser();
  if (!user) return null;

  if (user.role !== 'owner' && user.role !== 'admin_finance') {
    return (
      <div className="card success-card">
        <span className="icon-tile lg danger" aria-hidden>
          <ShieldAlert size={26} />
        </span>
        <h2>Tidak punya akses</h2>
        <p className="muted">Halaman ini hanya bisa diakses Owner dan Admin.</p>
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
          <Gavel size={24} />
        </span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Jenis Pelanggaran</h1>
          <p className="page-head-sub">Pilihan jenis di form Pelanggaran Peraturan</p>
        </div>
      </header>
      <JenisPelanggaranPanel />
    </>
  );
}
