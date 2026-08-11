import { redirect } from 'next/navigation';
import { getAuthState } from '@/lib/core/auth';
import { guardOps } from '@/lib/core/routing';
import ApprovalKondisiPanel from '@/components/ApprovalKondisiPanel';

export default async function ApprovalCheckoutPage() {
  const s = await getAuthState();
  const gate = guardOps(s);
  if (gate !== true) redirect(gate);

  if (!['owner', 'staff_admin'].includes(s.user!.role)) {
    return <div className="page-card"><p>Tidak punya akses.</p></div>;
  }

  return (
    <div className="page-card">
      <h1 className="page-title">Approval Check-out</h1>
      <ApprovalKondisiPanel fase="akhir" userName={s.user!.name} />
    </div>
  );
}
