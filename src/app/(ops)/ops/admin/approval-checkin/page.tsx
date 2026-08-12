import { redirect } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { getAuthState } from '@/lib/core/auth';
import { guardOps } from '@/lib/core/routing';
import ApprovalKondisiPanel from '@/components/ApprovalKondisiPanel';

export default async function ApprovalCheckinPage() {
  const s = await getAuthState();
  const gate = guardOps(s);
  if (gate !== true) redirect(gate);

  if (!['owner', 'staff_admin'].includes(s.user!.role)) {
    return <div className="card"><p className="muted">Tidak punya akses.</p></div>;
  }

  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden><ClipboardCheck size={24} /></span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Approval Check-in</h1>
          <p className="page-head-sub">Setujui kondisi kamar sebelum penghuni masuk</p>
        </div>
      </header>
      <ApprovalKondisiPanel fase="awal" userName={s.user!.name} />
    </>
  );
}
