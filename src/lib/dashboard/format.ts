/* =========================================================================
   Util format & tanggal Dashboard — PORT VERBATIM dari public/app.js (Fase 4).

   Semua fungsi di sini MURNI (tanpa DOM, tanpa state global) sehingga bisa
   dipakai Server Component maupun Client Component, dan bisa diuji unit.

   Catatan port: `esc()` milik app.js TIDAK ikut — React meng-escape teks secara
   otomatis, jadi mempertahankannya justru menghasilkan entitas ganda (&amp;lt;).
   `safeUrl()` TETAP ada karena React tidak memblokir skema `javascript:` pada href.
   ========================================================================= */

/** Hanya izinkan http(s)/mailto/tel — blokir javascript:, data:, dll. */
export const safeUrl = (u: unknown): string => {
  const s = String(u == null ? '' : u).trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(s) ? s : '#';
};

export const initials = (name?: string): string =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const slug = (s: unknown): string =>
  String(s || '')
    .toLowerCase()
    .replace(/[()]/g, '')
    .trim()
    .replace(/\s+/g, '-');

/** Normalisasi nomor HP Indonesia → format wa.me (62…). */
export const digits = (s: unknown): string => {
  const d = String(s || '').replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.startsWith('62')) return d;
  if (d.startsWith('0')) return '62' + d.slice(1);
  if (d.startsWith('8')) return '62' + d; // nomor tanpa 0 di depan (mis. 895329656137)
  return d;
};

/** Tampilan No HP rapi: pakai 0 di depan (08xx). */
export const fmtHP = (s: unknown): string => {
  const d = digits(s);
  return d ? (d.startsWith('62') ? '0' + d.slice(2) : d) : '—';
};

/** Angka dengan pemisah ribuan (id-ID) + satuan opsional. */
export const fmtNum = (n: unknown, unit?: string): string => {
  const x = Number(n);
  const s = isNaN(x) ? String(n) : x.toLocaleString('id-ID');
  return unit ? s + ' ' + unit : s;
};

/** Tick sumbu Y dinamis: `count` label dari 0..max (dibulatkan). */
export const niceTicks = (max: number, count?: number, unit?: string): string[] => {
  const c = count || 4;
  const top = Math.max(1, Math.ceil(Number(max) || 0));
  return Array.from({ length: c }, (_, i) => fmtNum(Math.round((top / (c - 1)) * i), unit));
};

/** Satuan uang otomatis: rb / Jt / M sesuai besaran. */
export const moneyScale = (max: unknown): { div: number; unit: string } => {
  const m = Math.abs(Number(max) || 0);
  if (m >= 1e9) return { div: 1e9, unit: 'M' };
  if (m >= 1e6) return { div: 1e6, unit: 'Jt' };
  if (m >= 1e3) return { div: 1e3, unit: 'rb' };
  return { div: 1, unit: '' };
};

export const scaleVals = (arr: unknown[], sc: { div: number }): number[] =>
  (arr || []).map((v) => Math.round((Number(v) / sc.div) * 10) / 10);

export interface Trend {
  badge: string;
  dir: 'up' | 'down';
  pct: number;
}

/** Badge tren scorecard dari deret data. Hijau = naik, merah = turun. */
export const trendBadge = (series: unknown): Trend => {
  const s = (Array.isArray(series) ? series : []).map(Number).filter((v) => !isNaN(v));
  const nz = s.filter((v) => v !== 0);
  if (s.length < 2 || nz.length < 1) return { badge: '0%', dir: 'up', pct: 0 };
  const last = s[s.length - 1];
  let base = 0;
  for (let i = s.length - 2; i >= 0; i--) {
    if (s[i] !== 0) {
      base = s[i];
      break;
    }
  }
  if (!base) base = nz[0];
  const pct = base ? Math.round(((last - base) / Math.abs(base)) * 100) : 0;
  return { badge: Math.abs(pct) + '%', dir: pct >= 0 ? 'up' : 'down', pct };
};

// ------------------------------------------------------------------ tanggal

const MONTHS_ID: Record<string, number> = {
  jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, maret: 2, apr: 3, april: 3, mei: 4,
  jun: 5, juni: 5, jul: 6, juli: 6, agu: 7, agt: 7, agustus: 7, sep: 8, september: 8,
  okt: 9, oktober: 9, nov: 10, november: 10, des: 11, desember: 11
};

export const MONTH_ID3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function parseDate(str: unknown): Date | null {
  if (!str) return null;
  const s = String(str).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO: 2026-06-15
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/); // 25 Mei 2026 / 2 Jun 2026
  if (m) {
    const mon = MONTHS_ID[m[2].toLowerCase()];
    if (mon != null) return new Date(+m[3], mon, +m[1]);
  }
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/); // 15/06/2026 (dd/mm/yyyy)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  // Angka serial Google Sheets: 46188 → 15 Jun 2026. Epoch = 30 Des 1899.
  // Rentang 25000–60000 ≈ 1968–2064 (hindari salah tangkap nominal).
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Math.floor(+s);
    if (n >= 25000 && n <= 60000) {
      const d = new Date(1899, 11, 30);
      d.setDate(d.getDate() + n);
      return d;
    }
  }
  return null;
}

/** Tampilkan tanggal apa pun formatnya sebagai "6 Jul 2026". */
export function fmtDateID(str: unknown): string {
  const d = parseDate(str);
  return d ? d.getDate() + ' ' + MONTH_ID3[d.getMonth()] + ' ' + d.getFullYear() : String(str || '');
}

/** Seperti parseDate, tapi menangkap jam:menit bila ada. */
export function parseDateTime(str: unknown): Date | null {
  const base = parseDate(str);
  if (!base) return null;
  const tm = String(str).match(/(\d{1,2}):(\d{2})/);
  if (tm) base.setHours(+tm[1], +tm[2], 0, 0);
  return base;
}

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export type PeriodName = 'Hari ini' | 'Minggu ini' | 'Bulan ini' | 'Tahun ini' | 'Custom' | string;

/**
 * Rentang periode. Di app.js membaca state global `cur`; di sini periode
 * diberikan eksplisit sbg argumen (§2.3: period/from/to jadi searchParams).
 */
export function periodRange(
  period: PeriodName,
  from?: string | null,
  to?: string | null
): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (period) {
    case 'Hari ini':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'Minggu ini': {
      const dow = (now.getDay() + 6) % 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - dow);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: startOfDay(mon), to: endOfDay(sun) };
    }
    case 'Bulan ini':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
      };
    case 'Tahun ini':
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: endOfDay(new Date(now.getFullYear(), 11, 31))
      };
    case 'Custom':
      return { from: from ? startOfDay(new Date(from)) : null, to: to ? endOfDay(new Date(to)) : null };
    default:
      return { from: null, to: null };
  }
}

/** Saring baris berdasarkan kolom tanggal; baris tanpa tanggal valid tetap tampil. */
export function filterByPeriod<T extends Record<string, any>>(
  data: T[],
  dateKey: string | undefined,
  period: PeriodName,
  cFrom?: string | null,
  cTo?: string | null
): T[] {
  if (!dateKey) return data;
  const { from, to } = periodRange(period, cFrom, cTo);
  if (!from && !to) return data;
  return data.filter((r) => {
    const d = parseDate(r[dateKey]);
    if (!d) return true;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

/** Jumlah baris per bulan (untuk sparkline metrik berbasis tanggal). */
export const monthlyCount = (rows: Record<string, any>[], dateKey: string): number[] => {
  const m = Array(12).fill(0);
  (rows || []).forEach((r) => {
    const d = parseDate(r && r[dateKey]);
    if (d) m[d.getMonth()]++;
  });
  return m;
};
