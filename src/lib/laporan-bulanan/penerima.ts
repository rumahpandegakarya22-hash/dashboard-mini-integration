export const MAKS_PENERIMA = 10;

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Terima array atau teks (dipisah koma, titik koma, spasi, baris baru). Hasil: huruf kecil, tanpa duplikat. */
export function uraiPenerima(mentah: unknown): { valid: string[]; salah: string[] } {
  const bagian = Array.isArray(mentah) ? mentah : String(mentah ?? '').split(/[,;\s]+/);
  const semua = [...new Set(bagian.map(e => String(e).trim().toLowerCase()).filter(Boolean))];
  return { valid: semua.filter(e => EMAIL_RE.test(e)), salah: semua.filter(e => !EMAIL_RE.test(e)) };
}

/** Isi app_config `laporan_email_to` (teks dipisah koma; satu alamat lama tetap sah) menjadi daftar alamat valid. */
export function penerimaDariConfig(teks: string | null | undefined): string[] {
  return uraiPenerima(teks).valid;
}
