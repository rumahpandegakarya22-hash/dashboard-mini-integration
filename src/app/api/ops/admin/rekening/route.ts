import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { setConfig } from '@/lib/app-config';
import { turso } from '@/lib/core/turso';
import { writeAudit } from '@/lib/core/audit';
import { bacaRekening } from '@/lib/pengingat/db';
import { KUNCI_REKENING, bolehKelolaRekening, validasiRekening, type Rekening } from '@/lib/pengingat/rekening';

// Hanya owner: nilai ini menentukan ke mana uang sewa ditransfer.
async function gate() {
  const user = await getSessionUser();
  return user && bolehKelolaRekening(user.role) ? user : null;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  return NextResponse.json(await bacaRekening(turso()));
}

export async function PUT(req: Request) {
  const user = await gate();
  if (!user) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });

  let baru: Rekening;
  try {
    baru = validasiRekening(await req.json().catch(() => null));
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Data tidak valid.' }, { status: 400 });
  }

  const { rekening: lama } = await bacaRekening(turso());
  await setConfig(KUNCI_REKENING, JSON.stringify(baru), user.name);
  await writeAudit({
    requestId: crypto.randomUUID(),
    user: { username: user.username, role: user.role },
    moduleId: 'rekening',
    action: 'UPDATE',
    target: `app_config → ${KUNCI_REKENING}`,
    oldData: lama ?? undefined,
    newData: baru,
    status: 'sukses'
  });
  return NextResponse.json(await bacaRekening(turso()));
}
