import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardAuth, requireOwner } from '@/lib/dashboard/api-guard';
import { setKepalaDivisi } from '@/lib/core/auth';

/**
 * Owner menandai atau mencabut "kepala divisi" pada akun Dashboard.
 * Bukan role baru: akun tetap berole divisinya, hanya mendapat hak mengatur target KPI divisi itu.
 */
export async function POST(req: NextRequest) {
  const g = await requireDashboardAuth();
  if (!g.ok) return g.res;
  const denied = requireOwner(g.user);
  if (denied) return denied;

  const { username, kepala } = (await req.json().catch(() => ({}))) as { username?: string; kepala?: unknown };
  if (typeof kepala !== 'boolean') return NextResponse.json({ error: 'Nilai kepala harus true atau false.' }, { status: 400 });

  try {
    const r = await setKepalaDivisi(String(username || ''), kepala);
    if (r === 'notfound') return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
    if (r === 'nonaktif') return NextResponse.json({ error: 'Akun harus aktif dulu.' }, { status: 400 });
    if (r === 'bukan_divisi') {
      return NextResponse.json({ error: 'Hanya akun role divisi (Admin and Finance, Sales, Marketing, Operasional) yang bisa jadi kepala.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/dashboard/users/kepala] gagal simpan:', e);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
