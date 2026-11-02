import { NextRequest, NextResponse } from 'next/server';
import { cronDiizinkan, jalankanCron } from '@/lib/laporan-bulanan/cron';
import { adalahBulanBerjalan, parsePeriode, periodeSebelumnya } from '@/lib/laporan-bulanan/periode';
import { LAPORAN, generateLaporan, laporanSudahAda } from '@/lib/laporan-bulanan/registry';

// 11 PDF berurutan butuh sekitar 1-2 menit. Bila paket Vercel membatasi 60 detik,
// pecah dengan parameter ?kelompok= dan tambah entri cron (belum diimplementasikan).
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!cronDiizinkan(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
  }

  // ?periode=YYYY-MM hanya untuk operator yang mengisi ulang bulan yang terlewat.
  const override = req.nextUrl.searchParams.get('periode');
  let kode: string;
  try {
    kode = override ? parsePeriode(override).kode : periodeSebelumnya(new Date()).kode;
    if (adalahBulanBerjalan(kode)) throw new Error('Bulan berjalan belum selesai. Pilih bulan lalu atau sebelumnya.');
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Periode tidak valid.' }, { status: 400 });
  }

  const hasil = await jalankanCron({
    laporan: LAPORAN,
    kode,
    sudahAda: id => laporanSudahAda(id, kode),
    generate: id => generateLaporan(id, kode, 'Jadwal otomatis'),
  });

  // 500 bila ada yang gagal agar Vercel menandai eksekusi cron sebagai gagal.
  const adaGagal = hasil.some(h => h.status === 'gagal');
  return NextResponse.json({ periode: kode, hasil }, { status: adaGagal ? 500 : 200 });
}
