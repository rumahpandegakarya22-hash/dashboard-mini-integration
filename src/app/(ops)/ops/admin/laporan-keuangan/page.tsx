import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { guardOps } from '@/lib/core/routing';
import LaporanKeuanganPanel from '@/components/LaporanKeuanganPanel';

export default async function LaporanKeuanganPage() {
  const s = await getAuthState();
  const gate = guardOps(s);
  if (gate !== true) redirect(gate);

  const role = s.user!.role;
  if (!['owner', 'staff_admin', 'staff_sales'].includes(role)) {
    return <div className="page-card"><p>Tidak punya akses.</p></div>;
  }

  return (
    <div className="page-card">
      <h1 className="page-title">Laporan Keuangan</h1>
      <LaporanKeuanganPanel />
    </div>
  );
}
