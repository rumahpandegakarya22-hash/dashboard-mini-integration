import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { LAPORAN, bacaBody, boleh, cariLaporan, generateLaporan } from '@/lib/laporan-bulanan/registry';
import { adalahBulanBerjalan, parsePeriode } from '@/lib/laporan-bulanan/periode';

async function requireAccess() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!boleh(user.role, {})) return { error: NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const gate = await requireAccess();
  if (gate.error) return gate.error;

  try {
    const diizinkan = LAPORAN.filter(l => !l.tersembunyi && boleh(gate.user!.role, l));
    const ids = diizinkan.map(l => l.id);
    const riwayatRes = await turso().execute({
      sql: `SELECT * FROM laporan_riwayat WHERE jenis IN (${ids.map(() => '?').join(',')}) ORDER BY created_at DESC, id DESC LIMIT 50`,
      args: ids,
    });

    return NextResponse.json({
      laporan: diizinkan.map(l => ({ id: l.id, judul: l.judul, keluarga: l.keluarga })),
      riwayat: riwayatRes.rows,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memuat data.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAccess();
  if (gate.error) return gate.error;

  const body = bacaBody(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ error: 'Body tidak valid. Kirim { id, periode }.' }, { status: 400 });
  const def = cariLaporan(body.id);
  if (!def) return NextResponse.json({ error: 'Jenis laporan tidak valid.' }, { status: 400 });
  if (!boleh(gate.user!.role, def)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });

  try {
    parsePeriode(body.periode);
    if (adalahBulanBerjalan(body.periode)) throw new Error('Bulan berjalan belum selesai. Pilih bulan lalu atau sebelumnya.');
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Periode tidak valid.' }, { status: 400 });
  }

  try {
    const { namaFile, driveUrl, riwayatId, catatanArsip } = await generateLaporan(def.id, body.periode, gate.user!.name);
    return NextResponse.json({ ok: true, namaFile, driveUrl, riwayatId, catatanArsip });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat laporan.' }, { status: 500 });
  }
}
