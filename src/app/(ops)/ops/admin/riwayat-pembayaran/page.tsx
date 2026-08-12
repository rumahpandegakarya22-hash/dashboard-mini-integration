import { redirect } from 'next/navigation';
import { History } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import RiwayatPembayaranPanel from '@/components/RiwayatPembayaranPanel';

export const dynamic = 'force-dynamic';

export default async function RiwayatPembayaranPage() {
  const user = await getSessionUser();
  const ALLOWED = new Set(['owner', 'staff_admin', 'staff_sales']);
  if (!user || !ALLOWED.has(user.role)) redirect('/ops');

  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden><History size={24} /></span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Riwayat Pembayaran</h1>
          <p className="page-head-sub">Riwayat pembayaran per penghuni</p>
        </div>
      </header>
      <RiwayatPembayaranPanel />
    </>
  );
}
