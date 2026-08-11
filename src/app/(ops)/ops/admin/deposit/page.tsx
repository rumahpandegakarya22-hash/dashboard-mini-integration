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
      <h1 className="page-title">Setting Deposit</h1>
      <DepositSettingPanel />
    </>
  );
}
