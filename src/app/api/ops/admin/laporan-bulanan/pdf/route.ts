import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { htmlKePdf } from '@/lib/invoice/pdf';
import { boleh, cariLaporan } from '@/lib/laporan-bulanan/registry';
import { parsePeriode } from '@/lib/laporan-bulanan/periode';

/** Regenerasi laporan dari Turso (tidak tergantung arsip Drive). format=html untuk pratinjau tanpa Chrome. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  if (!boleh(user.role, {})) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const def = cariLaporan(q.get('id') ?? '');
  if (!def) return NextResponse.json({ error: 'Jenis laporan tidak valid.' }, { status: 400 });
  if (!boleh(user.role, def)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });

  let periode;
  try {
    periode = parsePeriode(q.get('periode') ?? '');
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Periode tidak valid.' }, { status: 400 });
  }

  const namaFile = def.namaFile(periode);
  try {
    const html = await def.render(periode, new Date());
    if (q.get('format') === 'html') {
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    const pdf = await htmlKePdf(html);
    const ascii = namaFile.replace(/[^\x20-\x7E]|["\\]/g, '_');
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(namaFile)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Gagal membuat laporan: ${msg}` }, { status: 500 });
  }
}
