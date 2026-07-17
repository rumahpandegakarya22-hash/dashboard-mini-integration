import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ShieldAlert, Hourglass } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { canAccess } from '@/lib/roles';
import { MODULES } from '@/lib/modules/registry';
import { isEditable } from '@/lib/modules/edit';
import { moduleIcon } from '@/components/module-icons';
import DynamicForm from '@/components/DynamicForm';
import EditPanel from '@/components/EditPanel';

export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return null; // (app)/layout sudah redirect

  const mod = MODULES.find((m) => m.id === id);
  if (!mod) notFound();

  const Icon = moduleIcon(mod.id);

  if (!canAccess(user.role, mod.id)) {
    return (
      <div className="card success-card">
        <span className="icon-tile lg danger" aria-hidden>
          <ShieldAlert size={26} />
        </span>
        <h2>Tidak punya akses</h2>
        <p className="muted">Modul “{mod.title}” bukan bagian dari divisi kamu. Hubungi Owner jika ini keliru.</p>
        <Link className="btn-plain" href="/">
          <ChevronLeft size={18} />
          Kembali ke Beranda
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="page-head">
        <span className="icon-tile lg" aria-hidden>
          <Icon size={24} />
        </span>
        <div>
          <h1 style={{ fontSize: '1.375rem' }}>{mod.title}</h1>
          <p className="page-head-sub">Semua kolom bertanda <span className="req">*</span> wajib diisi</p>
        </div>
      </header>

      {mod.ready && mod.fields ? (
        <>
          <DynamicForm moduleId={mod.id} fields={mod.fields} hasPreview={mod.hasPreview} autoFillTrigger={mod.autoFillTrigger} />
          {isEditable(mod.id) && <EditPanel moduleId={mod.id} fields={mod.fields} />}
        </>
      ) : (
        <div className="card success-card">
          <span className="icon-tile lg warn" aria-hidden>
            <Hourglass size={26} />
          </span>
          <h2>Segera hadir</h2>
          <p className="muted">Form modul ini sedang disiapkan.</p>
          <Link className="btn-plain" href="/">
            <ChevronLeft size={18} />
            Kembali ke Beranda
          </Link>
        </div>
      )}
    </>
  );
}
