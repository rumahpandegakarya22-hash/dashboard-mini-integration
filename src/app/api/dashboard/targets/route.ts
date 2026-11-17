import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboard/api-guard';
import { turso } from '@/lib/core/turso';
import { nowWib } from '@/lib/core/validate';
import { DEFINISI_TARGET, bolehUbahTarget } from '@/lib/dashboard/targets';

/**
 * Atur target KPI. Body: { kunci, nilai } untuk menyimpan, { kunci, nilai: null } untuk
 * kembali ke nilai bawaan. Owner boleh semua; kepala divisi hanya divisinya; Pengawas tidak boleh.
 */
export async function PUT(req: NextRequest) {
  const g = await requireDashboardAuth();
  if (!g.ok) return g.res;

  const b = (await req.json().catch(() => ({}))) as { kunci?: unknown; nilai?: unknown };
  const def = DEFINISI_TARGET.find((t) => t.kunci === b.kunci);
  if (!def) return NextResponse.json({ error: 'Target tidak dikenal.' }, { status: 400 });
  if (!bolehUbahTarget(g.user.role, def.divisi)) {
    return NextResponse.json({ error: 'Anda tidak boleh mengubah target divisi ini.' }, { status: 403 });
  }

  try {
    if (b.nilai === null) {
      await turso().execute({ sql: 'DELETE FROM kpi_target WHERE kunci = ?', args: [def.kunci] });
      return NextResponse.json({ ok: true, nilai: def.nilaiBawaan, bawaan: true });
    }
    const n = typeof b.nilai === 'number' ? b.nilai : Number(String(b.nilai ?? '').replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
      return NextResponse.json({ error: 'Nilai harus angka 0 atau lebih.' }, { status: 400 });
    }
    await turso().execute({
      sql: `INSERT INTO kpi_target (kunci, nilai, diubah_oleh, diubah_pada) VALUES (?, ?, ?, ?)
            ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada`,
      args: [def.kunci, n, g.user.username, nowWib()]
    });
    return NextResponse.json({ ok: true, nilai: n, bawaan: false });
  } catch (e) {
    console.error('[api/dashboard/targets] gagal simpan:', e);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
