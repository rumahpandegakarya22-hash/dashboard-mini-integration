import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { canAccess } from '@/lib/roles';
import { MODULES } from '@/lib/modules/registry';
import DynamicForm from '@/components/DynamicForm';

export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) return null; // proxy.ts sudah redirect

  const mod = MODULES.find((m) => m.id === id);
  if (!mod) notFound();

  if (!canAccess(user.role, mod.id)) {
    return (
      <>
        <div className="topbar">
          <h1>{mod.icon} {mod.title}</h1>
        </div>
        <p className="error">Anda tidak punya akses ke modul ini.</p>
        <Link className="btn-link" href="/">← Kembali ke menu</Link>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <h1>{mod.icon} {mod.title}</h1>
      </div>
      {mod.ready && mod.fields ? (
        <DynamicForm moduleId={mod.id} fields={mod.fields} hasPreview={mod.hasPreview} />
      ) : (
        <div className="card">
          <p className="muted">Form modul ini segera hadir.</p>
        </div>
      )}
      <Link className="btn-link" href="/">← Kembali ke menu</Link>
    </>
  );
}
