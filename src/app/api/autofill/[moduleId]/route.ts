import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { canAccess } from '@/lib/roles';
import { MODULES } from '@/lib/modules/registry';
import { AUTOFILL_HANDLERS } from '@/lib/modules/handlers';

// Auto-fill TANPA efek samping (tidak menulis sheet) — dipanggil DynamicForm setiap kali field
// pemicu (ModuleMeta.autoFillTrigger) berubah & sudah terisi semua. Beda dgn /api/preview yg
// menampilkan layar konfirmasi; ini langsung mengisi nilai field lain di form yg sama.
export async function POST(req: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  if (!canAccess(user.role, moduleId)) {
    return NextResponse.json({ error: 'Anda tidak punya akses ke modul ini.' }, { status: 403 });
  }

  const mod = MODULES.find((m) => m.id === moduleId);
  const handler = AUTOFILL_HANDLERS[moduleId];
  if (!mod || !mod.autoFillTrigger || !handler) {
    return NextResponse.json({ error: 'Modul ini tidak punya auto-fill.' }, { status: 501 });
  }

  const body = await req.json().catch(() => ({}));
  const values: Record<string, unknown> = body?.values || {};

  try {
    const result = await handler(values, { user, requestId: 'autofill' });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal menghitung auto-fill.' }, { status: 400 });
  }
}
