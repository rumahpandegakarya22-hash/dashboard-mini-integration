/** Nopol disimpan seragam (huruf besar, spasi tunggal) supaya pencarian "AB 1234 CD" selalu cocok. */
export function normalisasiNopol(v: unknown): string {
  return String(v ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/([A-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Z])/g, '$1 $2')
    .trim();
}

/** Kosong boleh; selain itu 3–12 karakter huruf/angka (mis. "AB 1234 CD"). Mengembalikan pesan galat atau null. */
export function galatNopol(nopolTernormalisasi: string): string | null {
  if (!nopolTernormalisasi) return null;
  if (!/^[A-Z]{1,2} \d{1,4}( [A-Z]{1,3})?$/.test(nopolTernormalisasi)) {
    return 'Format nopol tidak dikenali. Contoh: AB 1234 CD.';
  }
  return null;
}

export const namaKendaraanBersih = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
