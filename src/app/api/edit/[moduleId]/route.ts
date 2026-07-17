import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { canAccess } from '@/lib/roles';
import { listEntries, saveEntry, isEditable } from '@/lib/modules/edit';
import { writeAudit } from '@/lib/audit';

/**
 * Fitur Edit Data per menu: GET = daftar entri terakhir modul (utk dipilih),
 * POST = timpa entri {ref, values}. Akses mengikuti akses modul (canAccess) —
 * siapa yang boleh input, dia yang boleh koreksi.
 */

async function guard(moduleId: string) {
  const user = await getSessionUser();
  if (!user) return { err: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!canAccess(user.role, moduleId)) {
    return { err: NextResponse.json({ error: 'Anda tidak punya akses ke modul ini.' }, { status: 403 }) };
  }
  if (!isEditable(moduleId)) {
    return { err: NextResponse.json({ error: 'Modul ini tidak punya fitur edit.' }, { status: 501 }) };
  }
  return { user };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const g = await guard(moduleId);
  if (g.err) return g.err;
  try {
    const entries = await listEntries(moduleId);
    return NextResponse.json({ ok: true, entries });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal memuat data.' }, { status: 400 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const g = await guard(moduleId);
  if (g.err) return g.err;

  const body = await req.json().catch(() => ({}));
  const ref = String(body?.ref || '');
  const values: Record<string, unknown> = body?.values || {};
  if (!ref) return NextResponse.json({ error: 'ref (entri yang diedit) wajib disertakan.' }, { status: 400 });

  const start = Date.now();
  const requestId = String(body?.requestId || `edit-${Date.now()}`);
  try {
    const warning = await saveEntry(moduleId, ref, values);
    await writeAudit({
      requestId,
      user: g.user!,
      moduleId,
      action: 'UPDATE',
      target: `${moduleId} ref=${ref}`,
      newData: values,
      durationSec: (Date.now() - start) / 1000,
      status: 'sukses'
    });
    return NextResponse.json({ ok: true, warning });
  } catch (e: any) {
    await writeAudit({
      requestId,
      user: g.user!,
      moduleId,
      action: 'UPDATE',
      target: `${moduleId} ref=${ref}`,
      durationSec: (Date.now() - start) / 1000,
      status: 'gagal',
      error: e?.message
    });
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan perubahan.' }, { status: 400 });
  }
}
