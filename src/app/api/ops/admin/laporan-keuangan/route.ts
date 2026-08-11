import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { turso } from '@/lib/core/turso';
import { getConfig, setConfig } from '@/lib/app-config';
import { queryLabaRugi, queryArusKas, queryNeraca } from '@/lib/laporan/generator';
import { htmlLabaRugi, htmlArusKas, htmlNeraca } from '@/lib/laporan/template';
import { htmlKePdf } from '@/lib/invoice/pdf';
import { arsipkanLaporan } from '@/lib/invoice/arsip';
import { kirimEmail } from '@/lib/core/email';

const ALLOWED = new Set(['owner', 'staff_admin', 'staff_sales']);

async function requireAccess() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Belum login.' }, { status: 401 }) };
  if (!ALLOWED.has(user.role)) {
    return { error: NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const gate = await requireAccess();
  if (gate.error) return gate.error;

  const [riwayatRes, emailTo] = await Promise.all([
    turso().execute('SELECT * FROM laporan_riwayat ORDER BY created_at DESC LIMIT 50'),
    getConfig('laporan_email_to'),
  ]);

  return NextResponse.json({ riwayat: riwayatRes.rows, emailTo });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAccess();
  if (gate.error) return gate.error;

  const body = await req.json() as { emailTo?: string };
  if (typeof body.emailTo !== 'string') {
    return NextResponse.json({ error: 'emailTo wajib diisi.' }, { status: 400 });
  }

  await setConfig('laporan_email_to', body.emailTo, gate.user!.name);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const gate = await requireAccess();
  if (gate.error) return gate.error;

  const body = await req.json() as {
    periode: string;
    jenis: 'Cashflow' | 'LabaRugi' | 'Neraca';
    emailTo?: string;
  };

  const { periode, jenis, emailTo } = body;
  if (!periode || !jenis) {
    return NextResponse.json({ error: 'periode dan jenis wajib diisi.' }, { status: 400 });
  }

  const [yearStr, monthStr] = periode.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const dari = `${periode}-01`;
  const sampai = new Date(year, month, 0).toISOString().slice(0, 10);

  const savedEmail = await getConfig('laporan_email_to');
  if (emailTo && emailTo !== savedEmail) {
    await setConfig('laporan_email_to', emailTo, gate.user!.name);
  }

  let html: string;
  try {
    if (jenis === 'LabaRugi') {
      const items = await queryLabaRugi(dari, sampai);
      html = htmlLabaRugi(items, periode, gate.user!.name);
    } else if (jenis === 'Cashflow') {
      const items = await queryArusKas(dari, sampai);
      html = htmlArusKas(items, periode, gate.user!.name);
    } else {
      const items = await queryNeraca(sampai);
      html = htmlNeraca(items, periode, gate.user!.name);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Gagal query data: ${msg}` }, { status: 500 });
  }

  let pdf: Buffer;
  try {
    pdf = await htmlKePdf(html);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Gagal generate PDF: ${msg}` }, { status: 500 });
  }

  const mm = String(month).padStart(2, '0');
  const yy = String(year).slice(-2);
  const namaFile = `${mm}${yy}-${jenis}-Kost Tiga Dara.pdf`;

  // Best-effort: Drive gagal tidak throw ke user
  const driveUrl = await arsipkanLaporan(namaFile, pdf);

  // Best-effort: email
  const targetEmail = emailTo || savedEmail;
  if (targetEmail) {
    try {
      await kirimEmail({
        to: targetEmail,
        subject: `Laporan ${namaFile}`,
        html: '<p>Terlampir laporan keuangan.</p>',
        lampiran: [{ namaFile, mime: 'application/pdf', isi: pdf }],
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[laporan] gagal kirim email:', msg);
    }
  }

  await turso().execute({
    sql: 'INSERT INTO laporan_riwayat (periode, jenis, nama_file, drive_url, dibuat_oleh) VALUES (?, ?, ?, ?, ?)',
    args: [periode, jenis, namaFile, driveUrl ?? null, gate.user!.name],
  });

  return NextResponse.json({ ok: true, namaFile, driveUrl });
}
