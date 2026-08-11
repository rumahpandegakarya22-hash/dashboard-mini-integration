import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { guardOps } from '@/lib/core/routing';
import KondisiKamarPanel from '@/components/KondisiKamarPanel';

export default async function PreCheckInPage() {
  const s = await getAuthState();
  const gate = guardOps(s);
  if (gate !== true) redirect(gate);

  const role = s.user!.role;
  if (!['owner', 'staff_admin', 'staff_inspeksi'].includes(role)) {
    return <div className="page-card"><p>Tidak punya akses.</p></div>;
  }

  return (
    <div className="page-card">
      <h1 className="page-title">Pre-Check In Form</h1>
      <KondisiKamarPanel fase="awal" />
    </div>
  );
}
