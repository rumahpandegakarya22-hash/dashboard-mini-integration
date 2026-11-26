const KOSONG = '—';

export const rp = (n: number | null): string =>
  n === null ? KOSONG : `${n < 0 ? '-' : ''}Rp${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;

/** Rp ringkas bertanda: "Rp15,6 Jt", "-Rp850 rb". */
export const rpRingkas = (n: number | null): string => {
  if (n === null) return KOSONG;
  const t = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1e9) return `${t}Rp${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
  if (v >= 1e6) return `${t}Rp${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Jt`;
  if (v >= 1e3) return `${t}Rp${Math.round(v / 1e3)} rb`;
  return `${t}Rp${Math.round(v)}`;
};

export const persen = (r: number | null): string =>
  r === null ? KOSONG : `${(r * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

export const bulan = (b: number | null, kosong = 'Tidak balik modal'): string => {
  if (b === null) return kosong;
  const thn = b / 12;
  return b < 12 ? `${b} bln` : `${b} bln (≈ ${thn.toLocaleString('id-ID', { maximumFractionDigits: 1 })} thn)`;
};

export const angkaId = (n: number, desimal = 2): string => n.toLocaleString('id-ID', { maximumFractionDigits: desimal });

/**
 * "1.250.000" / "12,5" / "0.5" → angka. Kosong atau tidak valid → 0.
 * Ada koma → koma desimal, titik = ribuan. Tanpa koma, satu titik yang tidak diikuti tepat 3 digit
 * dianggap desimal (keyboard HP sering memberi titik), selain itu titik = ribuan.
 */
export const bacaAngka = (s: string): number => {
  const t = s.replace(/\s|Rp/gi, '');
  const desimalTitik = !t.includes(',') && /^-?\d*\.\d{1,2}$|^-?\d*\.\d{4,}$/.test(t);
  const n = Number(desimalTitik ? t : t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
