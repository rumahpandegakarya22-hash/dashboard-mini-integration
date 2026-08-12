import { redirect } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { getAuthState } from '@/lib/core/auth';
import { guardOps } from '@/lib/core/routing';
import DaftarBookingPanel from '@/components/DaftarBookingPanel';

export default async function DaftarBookingPage() {
  const s = await getAuthState();
  const gate = guardOps(s);
  if (gate !== true) redirect(gate);

  if (!['owner', 'staff_admin'].includes(s.user!.role)) {
    return <div className="card"><p className="muted">Tidak punya akses.</p></div>;
  }

  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden><ClipboardList size={24} /></span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Daftar Booking</h1>
          <p className="page-head-sub">Booking yang menunggu check-in</p>
        </div>
      </header>
      <DaftarBookingPanel />
    </>
  );
}
