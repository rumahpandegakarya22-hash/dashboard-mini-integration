import { BedDouble } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import StatusKamarPanel from '@/components/StatusKamarPanel';

export const metadata = { title: 'Status Kamar' };

export default async function StatusKamarPage() {
  const user = await getSessionUser();
  if (!user || !['owner', 'admin_finance', 'operasional'].includes(user.role)) {
    return (
      <div className="card">
        <p className="muted">Tidak punya akses ke halaman ini.</p>
      </div>
    );
  }
  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden>
          <BedDouble size={24} />
        </span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Status Kamar</h1>
          <p className="page-head-sub">Tandai kamar Maintenance atau selesaikan Maintenance</p>
        </div>
      </header>
      <StatusKamarPanel />
    </>
  );
}
