import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { canAccess } from '@/lib/roles';
import { MODULES } from '@/lib/modules/registry';
import { PREVIEW_HANDLERS } from '@/lib/modules/handlers';
import { rateLimitOk } from '@/lib/redis';

// Preview TANPA efek samping (tidak menulis sheet, tidak audit, tidak idempotency-claim) — aman dipanggil
// berkali-kali saat user masih mengubah isian form. Beda dgn /api/submit/[moduleId] yang menulis data.
export async function POST(req: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  if (!(await rateLimitOk(`preview:${user.id}`, 30, 60))) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan. Tunggu sebentar.' }, { status: 429 });
  }
  if (!canAccess(user.role, moduleId)) {
    return NextResponse.json({ error: 'Anda tidak punya akses ke modul ini.' }, { status: 403 });
  }

  const mod = MODULES.find((m) => m.id === moduleId);
  const handler = PREVIEW_HANDLERS[moduleId];
  if (!mod || !mod.hasPreview || !handler) {
    return NextResponse.json({ error: 'Modul ini tidak punya preview.' }, { status: 501 });
  }

  const body = await req.json().catch(() => ({}));
  const values: Record<string, unknown> = body?.values || {};

  try {
    const result = await handler(values, { user, requestId: 'preview' });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error('[preview]', e);
    // Pesan validasi handler (Error dgn pesan pendek) tetap ditampilkan ke user; sisanya digeneralkan.
    const msg = e instanceof Error && e.message && e.message.length < 120 ? e.message : 'Terjadi kesalahan. Coba lagi.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
