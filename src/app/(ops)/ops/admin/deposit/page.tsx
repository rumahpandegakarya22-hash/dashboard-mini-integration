import { Wallet } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import DepositSettingPanel from '@/components/DepositSettingPanel';

export const metadata = { title: 'Setting Deposit' };

export default async function DepositPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'owner' && user.role !== 'staff_admin')) {
    return (
      <div className="card">
        <p className="muted">Tidak punya akses ke halaman ini.</p>
      </div>
    );
  }
  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden><Wallet size={24} /></span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Setting Deposit</h1>
          <p className="page-head-sub">Aktifkan &amp; atur nominal deposit penghuni baru</p>
        </div>
      </header>
      <DepositSettingPanel />
    </>
  );
}
