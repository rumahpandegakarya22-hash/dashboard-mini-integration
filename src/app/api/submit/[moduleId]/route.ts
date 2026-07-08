import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { canAccess } from '@/lib/roles';
import { MODULES } from '@/lib/modules/registry';
import { HANDLERS } from '@/lib/modules/handlers';
import { claimRequestId, redis, nsKey } from '@/lib/redis';
import { writeAudit } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  if (!canAccess(user.role, moduleId)) {
    return NextResponse.json({ error: 'Anda tidak punya akses ke modul ini.' }, { status: 403 });
  }

  const mod = MODULES.find((m) => m.id === moduleId);
  const handler = HANDLERS[moduleId];
  if (!mod || !mod.ready || !handler) {
    return NextResponse.json({ error: 'Modul ini belum tersedia.' }, { status: 501 });
  }

  const body = await req.json().catch(() => ({}));
  const requestId: string | undefined = body?.requestId;
  const values: Record<string, unknown> = body?.values || {};
  if (!requestId) return NextResponse.json({ error: 'request_id wajib disertakan.' }, { status: 400 });

  const claimed = await claimRequestId(requestId);
  if (!claimed) {
    return NextResponse.json({ error: 'Permintaan ini sudah diproses sebelumnya.' }, { status: 409 });
  }

  const start = Date.now();
  try {
    const result = await handler(values, { user, requestId });
    await writeAudit({
      requestId,
      user,
      moduleId,
      action: 'CREATE',
      target: result.target,
      row: result.row,
      newData: result.data,
      durationSec: (Date.now() - start) / 1000,
      status: 'sukses'
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    await redis.del(nsKey(`req:${requestId}`)); // lepas klaim agar retry sah bisa dicoba lagi
    await writeAudit({
      requestId,
      user,
      moduleId,
      action: 'CREATE',
      target: moduleId,
      durationSec: (Date.now() - start) / 1000,
      status: 'gagal',
      error: e?.message
    });
    return NextResponse.json({ error: e?.message || 'Gagal menyimpan data.' }, { status: 400 });
  }
}
