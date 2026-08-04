import { Readable } from 'node:stream';
import { driveClient, withRetry } from '../core/google';

/**
 * Simpan salinan PDF invoice ke folder Drive sesuai jenisnya.
 *
 * Best-effort: invoice sudah terkirim ke penghuni sebelum ini dipanggil, dan
 * isinya selalu bisa dibuat ulang dari Turso — jadi gagal mengarsip TIDAK boleh
 * membatalkan apa pun, cukup jadi peringatan.
 */
export async function arsipkanInvoice(jenis: 'DP' | 'Sewa', namaFile: string, pdf: Buffer): Promise<string | undefined> {
  const folderId = jenis === 'Sewa' ? process.env.DRIVE_FOLDER_INVOICE_SEWA : process.env.DRIVE_FOLDER_INVOICE_DP;
  if (!folderId) return undefined; // arsip tidak dikonfigurasi — bukan error

  try {
    await withRetry(() =>
      driveClient().files.create({
        requestBody: { name: namaFile, parents: [folderId] },
        media: { mimeType: 'application/pdf', body: Readable.from(pdf) },
        fields: 'id',
        supportsAllDrives: true
      })
    );
    return undefined;
  } catch (e: any) {
    console.error('[invoice] gagal arsip ke Drive:', e?.message);
    return `Invoice terkirim tapi gagal diarsipkan ke Drive (${e?.message || 'unknown error'}).`;
  }
}
