import { Landmark } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import AsetTetapPanel from '@/components/AsetTetapPanel';

export const metadata = { title: 'Aset Tetap & Penyusutan' };

export default async function AsetTetapPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'owner' && user.role !== 'staff_admin')) {
    return (
      <div className="card">
        <p className="muted">Tidak punya akses ke halaman ini.</p>
      </div>
    );
  }
  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden><Landmark size={24} /></span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Aset Tetap &amp; Penyusutan</h1>
          <p className="page-head-sub">Register aset + posting penyusutan garis lurus</p>
        </div>
      </header>
      <AsetTetapPanel />
    </>
  );
}
