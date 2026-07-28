import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ShieldAlert, Hourglass } from 'lucide-react';
import { getSessionUser } from '@/lib/core/auth';
import { canAccess } from '@/lib/core/roles';
import { MODULES } from '@/lib/modules/registry';
import { isEditable } from '@/lib/modules/edit';
import { moduleIcon } from '@/components/module-icons';
import Accordion from '@/components/Accordion';
import DynamicForm from '@/components/DynamicForm';
import EditPanel from '@/components/EditPanel';
import ModulePanel, { punyaPanel } from '@/components/ModulePanel';

export default async function ModulePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // Prefill form via query string (mis. link "Catat Pengeluaran" dari joblist Admin).
  // Nilai string tunggal saja; field ekstra (woId) ikut terkirim ke handler lewat pipeline submit.
  const sp = await searchParams;
  const initialValues = Object.fromEntries(
    Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '')
  );
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
        <Link className="btn-plain" href="/ops">
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
        {mod.ready && mod.fields && isEditable(mod.id) && (
          <div className="page-head-actions">
            <EditPanel moduleId={mod.id} fields={mod.fields} />
          </div>
        )}
      </header>

      {mod.ready && mod.fields ? (
        <>
          {punyaPanel(mod.id) ? (
            // Modul dengan panel review: form input bukan lagi alasan utama
            // halaman ini dibuka, jadi dilipat supaya antrean kerja yang
            // terlihat lebih dulu. Isinya tetap di DOM — lihat Accordion.
            <Accordion
              title={`Input ${mod.title.split(' & ')[0]} Manual`}
              subtitle="Untuk yang dicatat langsung oleh staf, bukan dari aplikasi penghuni"
            >
              <div className="form-col">
                <DynamicForm
                  moduleId={mod.id}
                  fields={mod.fields}
                  hasPreview={mod.hasPreview}
                  autoFillTrigger={mod.autoFillTrigger}
                  initialValues={Object.keys(initialValues).length > 0 ? initialValues : undefined}
                />
              </div>
            </Accordion>
          ) : (
            <div className="form-col">
              <DynamicForm
                moduleId={mod.id}
                fields={mod.fields}
                hasPreview={mod.hasPreview}
                autoFillTrigger={mod.autoFillTrigger}
                initialValues={Object.keys(initialValues).length > 0 ? initialValues : undefined}
              />
            </div>
          )}
          <ModulePanel moduleId={mod.id} />
        </>
      ) : (
        <div className="card success-card">
          <span className="icon-tile lg warn" aria-hidden>
            <Hourglass size={26} />
          </span>
          <h2>Segera hadir</h2>
          <p className="muted">Form modul ini sedang disiapkan.</p>
          <Link className="btn-plain" href="/ops">
            <ChevronLeft size={18} />
            Kembali ke Beranda
          </Link>
        </div>
      )}
    </>
  );
}
