import { driveClient, withRetry } from './core/google';

/* ==========================================================================
   Penamaan SEMUA berkas dokumen penghuni di Drive:

     (Jenis Docs)-(ID Docs)-(ID Penghuni).ext
     contoh: KTP-DOC-20260804-a1b2c3d4-KTD-2608-001.jpg
             Bukti Bayar-INV-23-TDU-9-2026-KTD-2608-001.jpg

   ID Docs memakai identitas yang SUDAH ada kalau dokumennya punya: bukti bayar
   memakai nomor invoice. Untuk dokumen yang tidak punya nomor apa pun (KTP, SIM,
   KK, kontrak), dipakai id_dokumen yang memang sudah dibuat saveLampiran saat
   mencatat lampiran ke tabel `dokumen` — jadi nama berkas di Drive bisa dilacak
   balik ke barisnya di database, bukan sekadar kode acak.

   Kenapa rename, bukan langsung dinamai saat unggah: berkas naik ke Drive
   BEGITU dipilih di form, sebelum submit — sedangkan pada modul Booking/Penghuni
   Baru, ID Penghuni baru lahir setelah submit tersimpan. Jadi berkas naik dengan
   nama sementara, lalu diganti di sini ketika semuanya sudah pasti.
   ========================================================================== */

export const JENIS_DOKUMEN = ['KTP', 'SIM', 'KK', 'Kontrak'] as const;
export type JenisDokumen = (typeof JENIS_DOKUMEN)[number];

/**
 * Buang karakter yang menyulitkan di nama berkas Drive.
 * Garis miring jadi tanda hubung, BUKAN spasi, supaya nomor invoice tetap terbaca
 * sebagai satu kesatuan (INV/23/TDU/9/2026 → INV-23-TDU-9-2026), sama dengan
 * penamaan arsip PDF invoice.
 */
function bersih(v: string): string {
  return String(v ?? '')
    .replace(/[\\/]+/g, '-')
    .replace(/[:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * `idPenghuni` opsional: dokumen operasional (nota pengeluaran, foto maintenance,
 * foto inspeksi) tidak melekat ke penghuni mana pun, jadi namanya berhenti di ID Docs.
 */
export function namaFileDokumen(p: { jenis: string; idDocs: string; idPenghuni?: string; ekstensi?: string }): string {
  const bagian = [bersih(p.jenis), bersih(p.idDocs), bersih(p.idPenghuni ?? '')].filter(Boolean).join('-');
  return p.ekstensi ? `${bagian}.${p.ekstensi.replace(/^\./, '')}` : bagian;
}

/** Ambil fileId dari webViewLink Drive (bentuknya .../file/d/<id>/view atau ?id=<id>). */
export function fileIdDariUrl(url: string): string | null {
  return (/\/d\/([A-Za-z0-9_-]{20,})/.exec(url) || /[?&]id=([A-Za-z0-9_-]{20,})/.exec(url) || [])[1] ?? null;
}

/**
 * Ganti nama berkas di Drive. Best-effort: nama yang kurang rapi tidak sebanding
 * dengan membatalkan submit yang datanya sudah tersimpan.
 */
export async function renameDokumenDrive(url: string, namaBaru: string): Promise<string | undefined> {
  const fileId = fileIdDariUrl(url);
  if (!fileId) return `Nama berkas Drive tidak diseragamkan: format URL tidak dikenali (${url}).`;
  try {
    const kini = await withRetry(() => driveClient().files.get({ fileId, fields: 'name', supportsAllDrives: true }));
    // Pertahankan ekstensi berkas aslinya — nama baru hanya mengatur bagian sebelum titik.
    const ext = (/\.([A-Za-z0-9]{1,5})$/.exec(kini.data.name || '') || [])[1];
    await withRetry(() =>
      driveClient().files.update({
        fileId,
        requestBody: { name: ext ? `${namaBaru}.${ext}` : namaBaru },
        supportsAllDrives: true
      })
    );
    return undefined;
  } catch (e: any) {
    console.error('[drive-dokumen] gagal rename:', e?.message);
    return `Data tersimpan, tapi nama berkas di Drive gagal diseragamkan (${e?.message || 'unknown error'}).`;
  }
}
