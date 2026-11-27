/* Foto kegiatan harian Cleaning: dipakai form (jenis chip) dan handler (validasi). */

export const JENIS_KEGIATAN = [
  'Sapu',
  'Pel',
  'Buang sampah',
  'Kebersihan dapur',
  'Kamar mandi',
  'Koridor & tangga',
  'Halaman & taman'
] as const;

export const MAKS_FOTO = 12;
const MAKS_JENIS = 40;
/** Foto selalu diunggah lewat /api/ops/upload → Google Drive. */
const AWAL_URL = 'https://drive.google.com/';

export interface FotoKegiatan {
  jenis: string;
  url: string;
}

/** Daftar foto → nilai field (string JSON); kosong bila tidak ada foto. */
export function serialisasiFoto(daftar: FotoKegiatan[]): string {
  return daftar.length ? JSON.stringify(daftar.map(({ jenis, url }) => ({ jenis, url }))) : '';
}

/** Nilai field → daftar foto tervalidasi. Pesan galat pendek (ditampilkan apa adanya ke user). */
export function bacaFoto(raw: unknown): FotoKegiatan[] {
  let data: unknown;
  try {
    data = JSON.parse(String(raw ?? ''));
  } catch {
    throw new Error('Foto kegiatan wajib diisi.');
  }
  if (!Array.isArray(data) || data.length === 0) throw new Error('Foto kegiatan wajib diisi.');
  if (data.length > MAKS_FOTO) throw new Error(`Maksimal ${MAKS_FOTO} foto per hari.`);
  return data.map((x) => {
    const jenis = String((x as { jenis?: unknown })?.jenis ?? '').trim().replace(/\s+/g, ' ');
    const url = String((x as { url?: unknown })?.url ?? '').trim();
    if (!jenis) throw new Error('Setiap foto harus punya jenis kegiatan.');
    if (jenis.length > MAKS_JENIS) throw new Error(`Nama kegiatan maksimal ${MAKS_JENIS} karakter.`);
    if (!url.startsWith(AWAL_URL)) throw new Error('Foto belum terunggah. Ambil ulang foto yang gagal.');
    return { jenis, url };
  });
}
