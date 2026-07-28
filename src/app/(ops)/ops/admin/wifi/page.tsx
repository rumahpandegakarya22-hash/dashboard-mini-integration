import Link from 'next/link';
import { ChevronLeft, ShieldAlert, Wifi } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import WifiPanel from '@/components/WifiPanel';

export default async function AdminWifiPage() {
  const user = await getSessionUser();
  if (!user) return null; // (ops)/layout sudah redirect ke /login

  if (user.role !== 'owner' && user.role !== 'staff_admin') {
    return (
      <div className="card success-card">
        <span className="icon-tile lg danger" aria-hidden>
          <ShieldAlert size={26} />
        </span>
        <h2>Tidak punya akses</h2>
        <p className="muted">Kredensial WiFi hanya bisa dikelola Owner dan Staff Admin.</p>
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
          <Wifi size={24} />
        </span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Kredensial WiFi</h1>
          <p className="page-head-sub">Nama jaringan &amp; password yang dilihat penghuni per kamar</p>
        </div>
      </header>
      <WifiPanel />
    </>
  );
}
