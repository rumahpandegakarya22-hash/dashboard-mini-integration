import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { getCcInvoice, setConfig, KUNCI_CC_INVOICE } from '@/lib/app-config';

const MAX_CC = 5;
const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

async function gate() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'owner' && user.role !== 'staff_admin')) return null;
  return user;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  return NextResponse.json({ ok: true, cc: await getCcInvoice() });
}

export async function POST(req: Request) {
  const user = await gate();
  if (!user) return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { cc?: unknown };
  const mentah = Array.isArray(body.cc) ? body.cc : String(body.cc ?? '').split(/[,;\s]+/);
  const cc = [...new Set(mentah.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];

  if (cc.length > MAX_CC) return NextResponse.json({ error: `Maksimal ${MAX_CC} email CC.` }, { status: 400 });
  const salah = cc.find((e) => !EMAIL_RE.test(e));
  if (salah) return NextResponse.json({ error: `Email tidak valid: "${salah}".` }, { status: 400 });

  await setConfig(KUNCI_CC_INVOICE, cc.join(','), user.name);
  return NextResponse.json({ ok: true, cc });
}
