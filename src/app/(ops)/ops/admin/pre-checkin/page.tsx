import { redirect } from 'next/navigation';
import { DoorOpen } from 'lucide-react';
import { getAuthState } from '@/lib/core/auth';
import { guardOps } from '@/lib/core/routing';
import KondisiKamarPanel from '@/components/KondisiKamarPanel';

export default async function PreCheckInPage() {
  const s = await getAuthState();
  const gate = guardOps(s);
  if (gate !== true) redirect(gate);

  const role = s.user!.role;
  if (!['owner', 'staff_admin', 'staff_inspeksi'].includes(role)) {
    return <div className="card"><p className="muted">Tidak punya akses.</p></div>;
  }

  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden><DoorOpen size={24} /></span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Pre-Check In</h1>
          <p className="page-head-sub">Form kondisi kamar sebelum penghuni masuk</p>
        </div>
      </header>
      <KondisiKamarPanel fase="awal" />
    </>
  );
}
