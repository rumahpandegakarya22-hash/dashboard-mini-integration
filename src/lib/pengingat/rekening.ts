/* Rekening tujuan pembayaran sewa (disimpan di app_config, diubah Owner). Murni. */
import type { Role } from '../core/roles';

export const KUNCI_REKENING = 'rekening_pembayaran';

export interface Rekening {
  bank: string;
  nomor: string;
  atasNama: string;
}

export const bolehKelolaRekening = (role: Role): boolean => role === 'owner';

export function validasiRekening(input: unknown): Rekening {
  const o = (input ?? {}) as Record<string, unknown>;
  // Satu baris saja: baris baru bisa menyisipkan instruksi transfer lain ke pesan penghuni.
  const teks = (v: unknown, label: string) => {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s || s.length > 80 || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(s)) throw new Error(`${label} wajib diisi (satu baris, maksimal 80 karakter).`);
    return s;
  };
  const r = { bank: teks(o.bank, 'Nama bank'), nomor: teks(o.nomor, 'Nomor rekening'), atasNama: teks(o.atasNama, 'Atas nama') };
  if (!/^[0-9][0-9 -]*$/.test(r.nomor)) throw new Error('Nomor rekening hanya boleh angka, spasi, dan tanda hubung.');
  return r;
}

export function bacaNilaiRekening(raw: string | null): Rekening | null {
  try {
    return validasiRekening(JSON.parse(raw ?? ''));
  } catch {
    return null;
  }
}

export const barisRekening = (r: Rekening): string => `🏦 ${r.bank} — ${r.nomor} a.n. ${r.atasNama}`;

/** Ganti baris rekening bawaan template Draft Info, juga bila templates.json dibuat ulang dari dokumen sumber. */
export const gantiRekeningTemplate = (isi: string, r: Rekening | null): string =>
  isi.replace(/^🏦.*a\.n\..*$/gmu, () => (r ? barisRekening(r) : '🏦 [Rekening belum diatur]'));
