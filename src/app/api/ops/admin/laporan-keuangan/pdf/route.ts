import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { buildLabaRugi, buildArusKas, buildNeraca } from '@/lib/laporan/generator';
import { htmlLabaRugi, htmlArusKas, htmlNeraca } from '@/lib/laporan/template';
import { htmlKePdf } from '@/lib/invoice/pdf';

const ALLOWED = new Set(['owner', 'staff_admin', 'staff_sales']);

/** Regenerate PDF laporan on-demand dari Turso (tidak tergantung arsip Drive).
 *  Dipakai tombol "Unduh PDF" di riwayat laporan. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  if (!ALLOWED.has(user.role)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });

  const periode = req.nextUrl.searchParams.get('periode') ?? '';
  const jenis = req.nextUrl.searchParams.get('jenis') ?? '';
  if (!/^\d{4}-\d{2}$/.test(periode)) {
    return NextResponse.json({ error: 'Format periode tidak valid.' }, { status: 400 });
  }
  if (!['Cashflow', 'LabaRugi', 'Neraca'].includes(jenis)) {
    return NextResponse.json({ error: 'Jenis laporan tidak valid.' }, { status: 400 });
  }

  const [yearStr, monthStr] = periode.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const dari = `${periode}-01`;
  const sampai = new Date(year, month, 0).toISOString().slice(0, 10);

  let html: string;
  if (jenis === 'LabaRugi') html = htmlLabaRugi(await buildLabaRugi(dari, sampai), periode, user.name);
  else if (jenis === 'Cashflow') html = htmlArusKas(await buildArusKas(dari, sampai), periode, user.name);
  else html = htmlNeraca(await buildNeraca(sampai), periode, user.name);

  const pdf = await htmlKePdf(html);
  const mm = String(month).padStart(2, '0');
  const yy = String(year).slice(-2);
  const namaFile = `${mm}${yy}-${jenis}-Kost Tiga Dara.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${namaFile}"`,
      'Cache-Control': 'no-store',
    },
  });
}
