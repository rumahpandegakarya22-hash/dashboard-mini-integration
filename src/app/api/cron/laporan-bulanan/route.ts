import { NextRequest, NextResponse } from 'next/server';
import { cronDiizinkan } from '@/lib/laporan-bulanan/cron';
import { parsePeriode, periodeSebelumnya } from '@/lib/laporan-bulanan/periode';
import { LAPORAN, generateLaporan, laporanSudahAda } from '@/lib/laporan-bulanan/registry';

// 11 PDF berurutan butuh sekitar 1-2 menit. Bila paket Vercel membatasi 60 detik,
// pecah dengan parameter ?kelompok= dan tambah entri cron (belum diimplementasikan).
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type Hasil = { id: string; status: 'dibuat' | 'dilewati' | 'gagal'; error?: string };

export async function GET(req: NextRequest) {
  if (!cronDiizinkan(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
  }

  // ?periode=YYYY-MM hanya untuk operator yang mengisi ulang bulan yang terlewat.
  const override = req.nextUrl.searchParams.get('periode');
  let kode: string;
  try {
    kode = override ? parsePeriode(override).kode : periodeSebelumnya(new Date()).kode;
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Periode tidak valid.' }, { status: 400 });
  }

  const hasil: Hasil[] = [];
  for (const l of LAPORAN) {
    try {
      if (await laporanSudahAda(l.id, kode)) {
        hasil.push({ id: l.id, status: 'dilewati' });
        continue;
      }
      await generateLaporan(l.id, kode, 'Jadwal otomatis');
      hasil.push({ id: l.id, status: 'dibuat' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal membuat laporan.';
      console.error('[cron laporan]', l.id, message);
      hasil.push({ id: l.id, status: 'gagal', error: message });
    }
  }

  return NextResponse.json({ periode: kode, hasil });
}
