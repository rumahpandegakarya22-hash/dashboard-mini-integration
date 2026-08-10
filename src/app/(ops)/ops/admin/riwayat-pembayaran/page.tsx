import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/core/auth';
import RiwayatPembayaranPanel from '@/components/RiwayatPembayaranPanel';

export const dynamic = 'force-dynamic';

export default async function RiwayatPembayaranPage() {
  const user = await getSessionUser();
  const ALLOWED = new Set(['owner', 'staff_admin', 'staff_sales']);
  if (!user || !ALLOWED.has(user.role)) redirect('/ops');

  return (
    <div className="form-col">
      <h1 className="page-title">Riwayat Pembayaran Per Penghuni</h1>
      <RiwayatPembayaranPanel />
    </div>
  );
}
