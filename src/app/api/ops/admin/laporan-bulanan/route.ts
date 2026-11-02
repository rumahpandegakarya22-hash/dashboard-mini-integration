import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { LAPORAN, boleh, cariLaporan, generateLaporan } from '@/lib/laporan-bulanan/registry';
import { parsePeriode } from '@/lib/laporan-bulanan/periode';

async function requireAccess() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!boleh(user.role, {})) return { error: NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const gate = await requireAccess();
  if (gate.error) return gate.error;

  const diizinkan = LAPORAN.filter(l => boleh(gate.user!.role, l));
  const ids = diizinkan.map(l => l.id);
  const riwayatRes = await turso().execute({
    sql: `SELECT * FROM laporan_riwayat WHERE jenis IN (${ids.map(() => '?').join(',')}) ORDER BY created_at DESC, id DESC LIMIT 50`,
    args: ids,
  });

  return NextResponse.json({
    laporan: diizinkan.map(l => ({ id: l.id, judul: l.judul, keluarga: l.keluarga })),
    riwayat: riwayatRes.rows,
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAccess();
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => ({})) as { id?: string; periode?: string };
  const def = cariLaporan(String(body.id ?? ''));
  if (!def) return NextResponse.json({ error: 'Jenis laporan tidak valid.' }, { status: 400 });
  if (!boleh(gate.user!.role, def)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });

  try {
    parsePeriode(String(body.periode ?? ''));
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Periode tidak valid.' }, { status: 400 });
  }

  try {
    const { namaFile, driveUrl, riwayatId } = await generateLaporan(def.id, body.periode!, gate.user!.name);
    return NextResponse.json({ ok: true, namaFile, driveUrl, riwayatId });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat laporan.' }, { status: 500 });
  }
}
