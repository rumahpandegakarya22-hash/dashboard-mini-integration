import Link from 'next/link';
import { ChevronLeft, ShieldAlert, Tag } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import KamarHargaPanel from '@/components/KamarHargaPanel';

export default async function AdminKamarPage() {
  const user = await getSessionUser();
  if (!user) return null; // (ops)/layout sudah redirect ke /login

  if (user.role !== 'owner') {
    return (
      <div className="card success-card">
        <span className="icon-tile lg danger" aria-hidden>
          <ShieldAlert size={26} />
        </span>
        <h2>Hanya untuk Owner</h2>
        <p className="muted">Halaman kelola harga kamar hanya bisa diakses akun Owner.</p>
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
          <Tag size={24} />
        </span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Kelola Harga Kamar</h1>
          <p className="page-head-sub">Tarif sewa per tipe &amp; durasi — dipakai invoice sewa dan DP</p>
        </div>
      </header>
      <KamarHargaPanel />
    </>
  );
}
