import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { kirimInvoice } from '@/lib/invoice';

export async function POST(req: NextRequest) {
  const user = await getSessionUser('ops');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.miniappRole !== 'staff_admin')
    return NextResponse.json({ error: 'Hanya staff_admin yang bisa mengirim ulang invoice.' }, { status: 403 });

  const { noInv, jenis } = await req.json();
  if (!noInv || !jenis) return NextResponse.json({ error: 'noInv dan jenis wajib diisi.' }, { status: 400 });
  if (jenis !== 'DP' && jenis !== 'Sewa')
    return NextResponse.json({ error: 'jenis harus DP atau Sewa.' }, { status: 400 });

  const hasil = await kirimInvoice(String(noInv), jenis as 'DP' | 'Sewa');
  return NextResponse.json(hasil, { status: hasil.terkirim ? 200 : 422 });
}
