import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { rateLimitOk } from '@/lib/core/redis';
import { getInvoiceDp, getInvoiceSewa } from '@/lib/invoice/data';
import { htmlKePdf } from '@/lib/invoice/pdf';
import { renderInvoiceDp, renderInvoiceSewa } from '@/lib/invoice/template';

const ALLOWED = new Set(['owner', 'staff_admin', 'staff_sales']);

/**
 * Preview invoice persis seperti yang dikirim ke penghuni.
 *   ?noInv=...&jenis=Sewa|DP            -> HTML (untuk ditampilkan di modal)
 *   ?noInv=...&jenis=Sewa|DP&format=pdf -> PDF (dibuka di tab baru)
 * Hanya membaca; tidak mengirim email dan tidak mengubah data.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  if (!ALLOWED.has(user.role)) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const noInv = (sp.get('noInv') ?? '').trim();
  const jenis = sp.get('jenis') === 'DP' ? 'DP' : sp.get('jenis') === 'Sewa' ? 'Sewa' : null;
  if (!noInv || !jenis) return NextResponse.json({ error: 'Invoice tidak valid.' }, { status: 400 });
  if (!(await rateLimitOk(`inv-preview:${user.id}`, 60, 300))) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan. Tunggu beberapa menit.' }, { status: 429 });
  }

  const inv = jenis === 'Sewa' ? await getInvoiceSewa(noInv) : await getInvoiceDp(noInv);
  if (!inv) return NextResponse.json({ error: `Invoice ${noInv} tidak ditemukan.` }, { status: 404 });

  const html = jenis === 'Sewa' ? renderInvoiceSewa(inv as any) : renderInvoiceDp(inv as any);

  if (sp.get('format') === 'pdf') {
    try {
      const pdf = await htmlKePdf(html);
      const namaFile = `${noInv}`.replace(/[/\:*?"<>|]+/g, '-') + '.pdf';
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${namaFile}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    } catch (e: unknown) {
      return NextResponse.json({ error: `Gagal membuat PDF: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
  }

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}
