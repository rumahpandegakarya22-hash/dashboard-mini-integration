import { Megaphone } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import DraftInfoPanel from '@/components/DraftInfoPanel';
import templates from '@/lib/draft-info/templates.json';
import type { TemplateInfo } from '@/lib/draft-info/parse-html';
import { turso } from '@/lib/core/turso';
import { bacaRekening } from '@/lib/pengingat/db';
import { gantiRekeningTemplate } from '@/lib/pengingat/rekening';

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
  const rekening = await bacaRekening(turso()).then((d) => d.rekening).catch((e) => {
    console.error('[draft-info] gagal membaca rekening:', e);
    return null;
  });
  const daftar = (templates as TemplateInfo[]).map((t) => ({ ...t, isi: gantiRekeningTemplate(t.isi, rekening) }));
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
      <DraftInfoPanel templates={daftar} />
    </>
  );
}
