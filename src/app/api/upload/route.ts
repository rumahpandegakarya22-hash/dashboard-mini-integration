import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { getSessionUser } from '@/lib/auth';
import { driveClient } from '@/lib/google';
import { rateLimitOk } from '@/lib/redis';

/**
 * Upload file (bukti foto WO / dokumen) ke Google Drive via Service Account
 * (Mini App Improvement §3). File TIDAK dibuat publik — hanya bisa dibuka akun
 * yang punya akses folder (share folder ke anggota organisasi + service account).
 * Maks 2 MB; tipe: pdf / word / png / jpeg.
 */

const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'png',
  'image/jpeg': 'jpg'
};

/** kind → env folder Drive. Folder baru cukup ditambah di env tanpa ubah kode. */
const KIND_FOLDERS: Record<string, string | undefined> = {
  'work-order': process.env.DRIVE_FOLDER_WORK_ORDER || process.env.DRIVE_FOLDER_MAINTENANCE,
  'dokumen': process.env.DRIVE_FOLDER_DOKUMEN,
  'penghuni': process.env.DRIVE_FOLDER_PENGHUNI,
  'feedback': process.env.DRIVE_FOLDER_FEEDBACK
};

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
  if (!(await rateLimitOk(`upload:${user.id}`, 20, 300))) {
    return NextResponse.json({ error: 'Terlalu banyak upload. Tunggu beberapa menit.' }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const kind = String(form?.get('kind') || '');
  if (!(file instanceof File)) return NextResponse.json({ error: 'File tidak ditemukan di request.' }, { status: 400 });

  const folderId = KIND_FOLDERS[kind];
  if (!folderId) {
    return NextResponse.json(
      { error: `Folder Drive untuk "${kind || '(kosong)'}" belum dikonfigurasi di environment.` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Ukuran file melebihi 2 MB.' }, { status: 400 });
  }
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Tipe file harus PDF, Word, PNG, atau JPEG.' }, { status: 400 });
  }

  const safeBase = (file.name.replace(/\.[^.]*$/, '') || 'file').replace(/[^\w\-. ]+/g, '_').slice(0, 80);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `${stamp}_${user.username}_${safeBase}.${ext}`;

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const res = await driveClient().files.create({
      requestBody: { name, parents: [folderId] },
      media: { mimeType: file.type, body: Readable.from(buf) },
      fields: 'id, webViewLink',
      supportsAllDrives: true
    });
    return NextResponse.json({ ok: true, url: res.data.webViewLink, fileId: res.data.id, fileName: file.name });
  } catch (e: any) {
    console.error('[upload] gagal:', e?.message);
    return NextResponse.json({ error: 'Upload ke Drive gagal: ' + (e?.message || '') }, { status: 500 });
  }
}
