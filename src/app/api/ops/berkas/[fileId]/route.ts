import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/core/auth';
import { driveClient, withRetry } from '@/lib/core/google';
import { rateLimitOk } from '@/lib/core/redis';

/**
 * Penyaji berkas Google Drive untuk layar Ops.
 *
 * Aplikasi penghuni Teman Rara menyimpan lampiran sebagai path relatif
 * `/api/berkas/<fileId>` — path itu milik domain Teman Rara dan tidak bisa
 * dibuka dari Ops. Route ini padanannya di sisi Ops: ambil fileId yang sama,
 * stream ulang setelah memverifikasi sesi Ops.
 *
 * Berkas TIDAK pernah dibuat publik di Drive. Satu-satunya jalan membukanya
 * adalah lewat route ini (atau route serupa di Teman Rara), sehingga tautan
 * yang bocor pun tidak berguna tanpa sesi yang sah.
 */

const MIME_AMAN = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

  const { fileId } = await params;
  // ID Drive: alfanumerik, dash, underscore. Menolak selain itu mencegah
  // fileId dipakai menyelundupkan path/parameter ke Google API.
  if (!/^[A-Za-z0-9_-]{10,120}$/.test(fileId)) {
    return NextResponse.json({ error: 'ID berkas tidak valid.' }, { status: 400 });
  }
  if (!(await rateLimitOk(`berkas:${user.id}`, 120, 300))) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan. Tunggu beberapa menit.' }, { status: 429 });
  }

  try {
    const meta = await withRetry(() =>
      driveClient().files.get({ fileId, fields: 'mimeType, size', supportsAllDrives: true })
    );
    const mime = meta.data.mimeType || 'application/octet-stream';
    // Jangan pernah menyajikan tipe di luar daftar aman: berkas Drive bisa
    // berisi HTML/SVG yang akan tereksekusi di origin Ops kalau di-render.
    if (!MIME_AMAN.has(mime)) {
      return NextResponse.json({ error: 'Tipe berkas tidak didukung.' }, { status: 415 });
    }

    const res = await withRetry(() =>
      driveClient().files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      )
    );

    return new NextResponse(Buffer.from(res.data as ArrayBuffer), {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (e: any) {
    const code = e?.code || e?.response?.status;
    if (code === 404) return NextResponse.json({ error: 'Berkas tidak ditemukan.' }, { status: 404 });
    if (code === 403) {
      // Penyebab paling umum: berkas diunggah akun Teman Rara (OAuth) sementara
      // Ops masih memakai service account yang tidak punya akses ke folder itu.
      console.error('[ops/berkas] akses ditolak Drive:', e?.message || e);
      return NextResponse.json(
        { error: 'Server tidak punya akses ke berkas ini. Cek konfigurasi Google Drive.' },
        { status: 403 }
      );
    }
    console.error('[ops/berkas]', e);
    return NextResponse.json({ error: 'Gagal memuat berkas.' }, { status: 500 });
  }
}
