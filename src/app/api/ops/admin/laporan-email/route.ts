import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { getPenerimaLaporan, setConfig, KUNCI_EMAIL_LAPORAN } from '@/lib/app-config';
import { MAKS_PENERIMA, uraiPenerima } from '@/lib/laporan-bulanan/penerima';
import { writeAudit } from '@/lib/core/audit';

// Hanya owner: email bulanan memuat Owner Review.
async function gate() {
  const user = await getSessionUser();
  return user && user.role === 'owner' ? user : null;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  return NextResponse.json({ penerima: await getPenerimaLaporan(), maks: MAKS_PENERIMA });
}

export async function PUT(req: Request) {
  const user = await gate();
  if (!user) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { penerima?: unknown };
  if (!Array.isArray(body.penerima)) return NextResponse.json({ error: 'penerima wajib berupa daftar.' }, { status: 400 });

  const { valid, salah } = uraiPenerima(body.penerima);
  if (salah.length) return NextResponse.json({ error: `Email tidak valid: "${salah[0]}".` }, { status: 400 });
  if (valid.length > MAKS_PENERIMA) return NextResponse.json({ error: `Maksimal ${MAKS_PENERIMA} email.` }, { status: 400 });

  await setConfig(KUNCI_EMAIL_LAPORAN, valid.join(','), user.name);
  await writeAudit({
    requestId: crypto.randomUUID(),
    user: { username: user.username, role: user.role },
    moduleId: 'laporan-email',
    action: 'UPDATE',
    target: 'app_config → laporan_email_to',
    newData: { jumlah: valid.length },
    status: 'sukses',
  });
  return NextResponse.json({ ok: true, penerima: valid });
}
