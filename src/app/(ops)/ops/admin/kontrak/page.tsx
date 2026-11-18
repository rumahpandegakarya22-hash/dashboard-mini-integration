import { FileSignature } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import KontrakSettingPanel from '@/components/KontrakSettingPanel';

export const metadata = { title: 'Setting Kontrak Sewa' };

export default async function KontrakPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'owner' && user.role !== 'admin_finance')) {
    return (
      <div className="card">
        <p className="muted">Tidak punya akses ke halaman ini.</p>
      </div>
    );
  }
  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden><FileSignature size={24} /></span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Setting Kontrak Sewa</h1>
          <p className="page-head-sub">Tampilkan atau sembunyikan persetujuan kontrak di Teman Rara</p>
        </div>
      </header>
      <KontrakSettingPanel />
    </>
  );
}
