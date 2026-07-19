import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboard/api-guard';
import { driveFolderFor } from '@/config/drive-folders';
import { driveClient } from '@/lib/core/google';

/**
 * Paritas `POST /api/documents` server.js: buat Sheet/Doc baru di folder Drive
 * milik role pemanggil. Sanitasi judul & pembentukan judul default di-port
 * verbatim (buang karakter kontrol, potong 100 karakter).
 *
 * Catatan: di deployment lama fitur ini selalu 503 karena data/drive-config.json
 * tidak ada — lihat src/config/drive-folders.ts.
 */
export async function POST(req: NextRequest) {
  const g = await requireDashboardAuth('documents');
  if (!g.ok) return g.res;

  const role = g.user.role;
  const body = (await req.json().catch(() => ({}))) as { type?: string; name?: string };
  const type = body.type || 'sheet';
  if (type !== 'sheet' && type !== 'doc') {
    return NextResponse.json({ error: 'Tipe dokumen tidak valid' }, { status: 400 });
  }

  // judul: buang karakter kontrol/baris-baru, batasi 100 karakter (verbatim)
  const cleaned = String(body.name || '')
    .split('')
    .filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127)
    .join('')
    .trim()
    .slice(0, 100);
  const title =
    cleaned || `${role}-doc-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-4)}`;

  const folderId = driveFolderFor(role);
  if (!folderId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    return NextResponse.json(
      { error: 'Integrasi Google Drive belum dikonfigurasi di server.', setup: true },
      { status: 503 }
    );
  }

  try {
    const mimeType =
      type === 'doc' ? 'application/vnd.google-apps.document' : 'application/vnd.google-apps.spreadsheet';
    const file = await driveClient().files.create({
      requestBody: { name: title, mimeType, parents: [folderId] },
      fields: 'id,name,webViewLink'
    });
    return NextResponse.json({ id: file.data.id, name: file.data.name, url: file.data.webViewLink });
  } catch (e) {
    console.error('[api/dashboard/documents] gagal buat file di Drive:', e);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
