import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig } from '@/lib/app-config';
import { kirimEmail } from '@/lib/core/email';
import { cronDiizinkan, jalankanCron } from '@/lib/laporan-bulanan/cron';
import { emailSetelahCron, kirimEmailBulanan } from '@/lib/laporan-bulanan/email-bulanan';
import { adalahBulanBerjalan, parsePeriode, periodeSebelumnya } from '@/lib/laporan-bulanan/periode';
import { LAPORAN, generateLaporan, laporanSudahAda, laporanUntukEmail, renderPdf } from '@/lib/laporan-bulanan/registry';

// 14 laporan + 1 email berurutan butuh sekitar 1-2 menit. Bila paket Vercel membatasi 60 detik,
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

  // PDF yang baru dibuat pada eksekusi ini dipakai ulang sebagai lampiran email.
  const pdfBaru = new Map<string, { namaFile: string; pdf: Buffer }>();
  const hasil = await jalankanCron({
    laporan: LAPORAN,
    kode,
    sudahAda: id => laporanSudahAda(id, kode),
    generate: async id => {
      const r = await generateLaporan(id, kode, 'Jadwal otomatis');
      pdfBaru.set(id, { namaFile: r.namaFile, pdf: r.pdf });
      return r;
    },
  });

  // Satu email berisi semua PDF ke alamat "Email Tujuan Laporan"; sekali per periode.
  const email = await emailSetelahCron(hasil, () =>
    kirimEmailBulanan({
      kode,
      label: parsePeriode(kode).label,
      laporan: laporanUntukEmail(),
      ambilPdf: async id => pdfBaru.get(id) ?? renderPdf(id, kode),
      tujuan: () => getConfig('laporan_email_to'),
      sudahTerkirim: async k => Boolean(await getConfig(`laporan_email_terkirim_${k}`)),
      tandaiTerkirim: k => setConfig(`laporan_email_terkirim_${k}`, new Date().toISOString(), 'Jadwal otomatis'),
      kirim: kirimEmail,
    }),
  );

  // 500 bila ada yang gagal agar Vercel menandai eksekusi cron sebagai gagal.
  const gagal = hasil.some(h => h.status === 'gagal') || email.status === 'gagal';
  return NextResponse.json({ periode: kode, hasil, email }, { status: gagal ? 500 : 200 });
}
