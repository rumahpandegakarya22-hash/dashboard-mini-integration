import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/core/turso';
import { hariIniIso } from '@/lib/format-tanggal';
import { cronDiizinkan } from '@/lib/laporan-bulanan/cron';
import { jalankanPengingat, kirimTelegram } from '@/lib/pengingat/telegram';

// Dipanggil Vercel Cron (vercel.json). Cadangan: n8n memanggil URL yang sama dengan header Authorization.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!cronDiizinkan(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diset.' }, { status: 500 });
  }

  const domain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const tautan = `${domain ? `https://${domain}` : req.nextUrl.origin}/ops`;
  try {
    return NextResponse.json(await jalankanPengingat(turso(), (teks) => kirimTelegram(token, chatId, teks), hariIniIso(), tautan));
  } catch (e: unknown) {
    console.error('[cron pengingat-tagihan]', e instanceof Error ? e.message : e);
    // 500 agar eksekusi cron tercatat gagal.
    return NextResponse.json({ error: 'Pengingat gagal dikirim. Lihat log.' }, { status: 500 });
  }
}
