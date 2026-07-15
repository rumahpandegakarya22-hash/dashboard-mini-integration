import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { updateWoStatus } from '@/lib/joblist';

/** Ubah status work order dari tabel joblist (divisi tujuan / owner / pengawas). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  const status = String(body?.status || '');
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id tidak valid.' }, { status: 400 });

  try {
    const ok = await updateWoStatus(id, status, user.role);
    if (!ok) {
      return NextResponse.json({ error: 'Work order tidak ditemukan atau bukan untuk divisi kamu.' }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gagal mengubah status.' }, { status: 400 });
  }
}
