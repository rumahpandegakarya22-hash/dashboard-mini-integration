import { Megaphone } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import DraftInfoPanel from '@/components/DraftInfoPanel';
import templates from '@/lib/draft-info/templates.json';
import type { TemplateInfo } from '@/lib/draft-info/parse-html';

export const metadata = { title: 'Draft Info Admin' };

export default async function DraftInfoPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'owner' && user.role !== 'admin_finance')) {
    return (
      <div className="card">
        <p className="muted">Tidak punya akses ke halaman ini.</p>
      </div>
    );
  }
  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden>
          <Megaphone size={24} />
        </span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>Draft Info Admin</h1>
          <p className="page-head-sub">Pengumuman dan pesan siap kirim ke WhatsApp</p>
        </div>
      </header>
      <DraftInfoPanel templates={templates as TemplateInfo[]} />
    </>
  );
}
