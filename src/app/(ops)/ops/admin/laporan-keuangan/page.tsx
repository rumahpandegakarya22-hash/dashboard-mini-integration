import { redirect } from 'next/navigation';
import { FileBarChart } from 'lucide-react';
import { getAuthState } from '@/lib/core/auth';
import { guardOps } from '@/lib/core/routing';
import LaporanKeuanganPanel from '@/components/LaporanKeuanganPanel';

export default async function LaporanKeuanganPage() {
  const s = await getAuthState();
  const gate = guardOps(s);
  if (gate !== true) redirect(gate);

  const role = s.user!.role;
  if (!['owner', 'staff_admin', 'staff_sales'].includes(role)) {
    return <div className="card"><p className="muted">Tidak punya akses.</p></div>;
  }

  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden><FileBarChart size={24} /></span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Laporan Keuangan</h1>
          <p className="page-head-sub">Laba rugi, arus kas &amp; neraca (PSAK)</p>
        </div>
      </header>
      <LaporanKeuanganPanel />
    </>
  );
}
