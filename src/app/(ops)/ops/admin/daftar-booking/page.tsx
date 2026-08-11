import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { guardOps } from '@/lib/core/routing';
import DaftarBookingPanel from '@/components/DaftarBookingPanel';

export default async function DaftarBookingPage() {
  const s = await getAuthState();
  const gate = guardOps(s);
  if (gate !== true) redirect(gate);

  if (!['owner', 'staff_admin'].includes(s.user!.role)) {
    return <div className="page-card"><p>Tidak punya akses.</p></div>;
  }

  return (
    <div className="page-card">
      <h1 className="page-title">Daftar Booking</h1>
      <DaftarBookingPanel />
    </div>
  );
}
