import { Wallet } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import { bolehKelolaRekening } from '@/lib/pengingat/rekening';
import RekeningPanel from '@/components/RekeningPanel';

export const metadata = { title: 'Rekening Pembayaran' };

export default async function RekeningPage() {
  const user = await getSessionUser();
  if (!user || !bolehKelolaRekening(user.role)) {
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
          <h1 style={{ fontSize: '1.375rem' }}>Rekening Pembayaran</h1>
          <p className="page-head-sub">Rekening tujuan di draft tagihan WhatsApp</p>
        </div>
      </header>
      <RekeningPanel />
    </>
  );
}
