import { turso } from '../../turso';
import { required } from '../../validate';
import type { SubmitHandler } from '../types';

/**
 * Upload Dokumen (Mini App Improvement §3): file sudah diunggah ke Google Drive
 * oleh /api/upload (folder internal, tidak publik) — handler ini tinggal
 * menyimpan metadata + URL-nya ke tabel Turso `dokumen`.
 */
export const submitUploadDocs: SubmitHandler = async (values, ctx) => {
  const judul = required(values.judul, 'Judul Dokumen');
  const divisi = required(values.divisi, 'Divisi');
  const linkDrive = required(values.file, 'File');
  if (!/^https:\/\//.test(linkDrive)) throw new Error('File belum terunggah — pilih file dan tunggu sampai selesai.');

  const idDokumen = `DOC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${ctx.requestId.slice(0, 8)}`;
  await turso().execute({
    sql: 'INSERT INTO dokumen (id_dokumen, judul, role, link_drive) VALUES (?, ?, ?, ?)',
    args: [idDokumen, judul, divisi, linkDrive]
  });

  return { target: `Turso → dokumen (${idDokumen})`, data: { ...values, idDokumen, uploadedBy: ctx.user.username } };
};
