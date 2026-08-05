/* =========================================================================
   Keuangan Dashboard — PORT VERBATIM dari `computeFinance()` + helper format
   uang di public/app.js (Fase 4 langkah 4).

   Menghitung pendapatan kotor, beban, laba bersih, dan deret per-bucket dari
   tab JURNAL TRANSAKSI. Kolom `dampak_laba` & `arus_kas` yang dipakai di sini
   dihasilkan `compute.ts` (computeJurnal) — jadi angka keuangan dashboard
   bersumber dari mesin formula yang sudah lolos golden test Fase 2.

   Bucket harian vs bulanan ditentukan otomatis: rentang ≤ 62 hari → harian.
   ========================================================================= */

import { parseDate, MONTH_ID3 } from '../format';
import type { SheetGrid } from '../source';

export interface FinanceResult {
  pendapatanKotor: number;
  beban: number;
  labaBersih: number;
  incomeBy: Record<string, number>;
  opexBy: Record<string, number>;
  labels: string[];
  cashSeries: number[];
  incSeries: number[];
  expSeries: number[];
  labaSeries: number[];
  /** Total diskon yang diberikan pada periode aktif (akun Beban Diskon). */
  diskonTotal: number;
  /** Diskon per bucket, sejajar dengan `labels`. */
  diskonSeries: number[];
  daily: boolean;
  nBuckets: number;
}

/** Akun tempat diskon dibukukan (COA 5129) — dicocokkan lewat nama, bukan kode,
 *  karena grid jurnal dashboard menyimpan NAMA akun pada kolom debit/kredit. */
const NAMA_AKUN_DISKON = 'beban diskon';

/** Rp ringkas: 1.2 Jt / 850 rb / Rp500 — verbatim `fmtRpShort()`. */
export const fmtRpShort = (n: number): string => {
  const v = Math.round(n || 0);
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + ' Jt';
  if (v >= 1e3) return Math.round(v / 1e3) + ' rb';
  return 'Rp' + v;
};

/** N entri terbesar dari peta nilai — verbatim `topEntries()`. */
export const topEntries = (obj: Record<string, number>, n: number): [string, number][] =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);

/** Pendekkan nama akun untuk label sumbu — verbatim `shortAcct()`. */
export const shortAcct = (s: unknown): string =>
  String(s)
    .replace(/^Beban\s+/i, '')
    .replace(/^Pendapatan\s+/i, '')
    .trim()
    .slice(0, 14);

/**
 * PORT VERBATIM `computeFinance(rows, range)`.
 * `rows` = grid tab JURNAL TRANSAKSI; `range` = rentang periode aktif.
 * Mengembalikan null bila tab tidak ada, kolom "dampak laba" tidak ditemukan,
 * atau tidak ada baris yang masuk rentang — pemanggil menampilkan empty-state.
 */
export function computeFinance(
  rows: SheetGrid | null | undefined,
  range: { from: Date | null; to: Date | null }
): FinanceResult | null {
  if (!Array.isArray(rows) || rows.length < 2) return null;

  const head = rows[0].map((h) => String(h).toLowerCase());
  const idx = (...names: string[]): number => {
    for (const n of names) {
      const i = head.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const ci = {
    tgl: idx('tanggal'),
    debit: idx('akun debit', 'debit'),
    kredit: idx('akun kredit', 'kredit'),
    dampak: idx('dampak laba'),
    arus: idx('arus kas')
  };
  if (ci.dampak < 0) return null;

  // "(1.234)" dan "-1.234" sama-sama negatif; "-" dan kosong = 0.
  const toSigned = (s: unknown): number => {
    const t = String(s == null ? '' : s).trim();
    if (!t || t === '-') return 0;
    const neg = /^\(.*\)$/.test(t) || t.startsWith('-');
    const n = parseInt(t.replace(/[^0-9]/g, ''), 10) || 0;
    return neg ? -n : n;
  };

  const from = range && range.from;
  const to = range && range.to;
  const recs: { d: Date; arus: number; dl: number; kredit: string; debit: string }[] = [];

  rows.slice(1).forEach((r) => {
    const d = parseDate(String(r[ci.tgl] || '').trim());
    if (!d) return;
    if (from && d < from) return;
    if (to && d > to) return;
    recs.push({
      d,
      arus: ci.arus >= 0 ? toSigned(r[ci.arus]) : 0,
      dl: toSigned(r[ci.dampak]),
      kredit: String(r[ci.kredit] || 'Pendapatan').trim(),
      debit: String(r[ci.debit] || 'Beban').trim()
    });
  });
  if (!recs.length) return null;

  let pendapatanKotor = 0;
  let beban = 0;
  const incomeBy: Record<string, number> = {};
  const opexBy: Record<string, number> = {};
  recs.forEach((x) => {
    if (x.dl > 0) {
      pendapatanKotor += x.dl;
      incomeBy[x.kredit] = (incomeBy[x.kredit] || 0) + x.dl;
    } else if (x.dl < 0) {
      const v = -x.dl;
      beban += v;
      opexBy[x.debit] = (opexBy[x.debit] || 0) + v;
    }
  });

  const minT = Math.min(...recs.map((x) => x.d.getTime()));
  const maxT = Math.max(...recs.map((x) => x.d.getTime()));
  const spanDays = Math.round((maxT - minT) / 86400000) + 1;
  const daily = spanDays <= 62;

  const keyOf = daily
    ? (d: Date) => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()
    : (d: Date) => d.getFullYear() + '-' + d.getMonth();
  const labOf = daily
    ? (d: Date) => d.getDate() + ' ' + MONTH_ID3[d.getMonth()]
    : (d: Date) => MONTH_ID3[d.getMonth()] + " '" + String(d.getFullYear()).slice(2);

  const buckets = new Map<string, { label: string; cash: number; inc: number; exp: number; diskon: number }>();
  const order: string[] = [];
  const repT: Record<string, number> = {};

  recs.forEach((x) => {
    const k = keyOf(x.d);
    if (!buckets.has(k)) {
      buckets.set(k, { label: labOf(x.d), cash: 0, inc: 0, exp: 0, diskon: 0 });
      order.push(k);
      repT[k] = x.d.getTime();
    }
    const b = buckets.get(k)!;
    if (x.arus > 0) b.cash += x.arus;
    if (x.dl > 0) b.inc += x.dl;
    else if (x.dl < 0) b.exp += -x.dl;
    if (x.debit.toLowerCase().includes(NAMA_AKUN_DISKON)) b.diskon += Math.abs(x.dl);
  });
  order.sort((a, b) => repT[a] - repT[b]);

  return {
    pendapatanKotor,
    beban,
    labaBersih: pendapatanKotor - beban,
    incomeBy,
    opexBy,
    labels: order.map((k) => buckets.get(k)!.label),
    cashSeries: order.map((k) => buckets.get(k)!.cash),
    incSeries: order.map((k) => buckets.get(k)!.inc),
    expSeries: order.map((k) => buckets.get(k)!.exp),
    labaSeries: order.map((k) => {
      const b = buckets.get(k)!;
      return b.inc - b.exp;
    }),
    diskonTotal: order.reduce((t, k) => t + buckets.get(k)!.diskon, 0),
    diskonSeries: order.map((k) => buckets.get(k)!.diskon),
    daily,
    nBuckets: order.length
  };
}

/** Cari grid tab JURNAL TRANSAKSI (deteksi via header Akun Debit + Kredit). */
export function findTransaksiGrid(sheets: Record<string, SheetGrid>): SheetGrid | null {
  const key = Object.keys(sheets).find((k) => {
    const r = sheets[k];
    if (!Array.isArray(r) || !r.length) return false;
    const h = r[0].map((x) => String(x).toLowerCase());
    return h.some((x) => x.includes('debit')) && h.some((x) => x.includes('kredit'));
  });
  return key ? sheets[key] : null;
}

/* ------------------------------------------------------- deret per tanggal */

export interface SeriesSet {
  name: string;
  rows: Record<string, any>[];
  dateKey: string;
}

export interface SeriesResult {
  labels: string[];
  seriesList: number[][];
  names: string[];
  daily: boolean;
}

/**
 * PORT VERBATIM `seriesByDate()` app.js — menghitung deret jumlah baris per
 * bucket tanggal untuk beberapa set sekaligus (mis. Leads vs Survey).
 * Bucket harian bila rentang ≤ 62 hari, selain itu bulanan.
 * Mengembalikan null bila tak ada tanggal valid dalam rentang → empty-state.
 */
export function seriesByDate(
  sets: SeriesSet[],
  range: { from: Date | null; to: Date | null }
): SeriesResult | null {
  const within = (d: Date | null) =>
    !!d && (!range.from || d >= range.from) && (!range.to || d <= range.to);

  const times: number[] = [];
  sets.forEach((s) =>
    (s.rows || []).forEach((r) => {
      const d = parseDate(r[s.dateKey]);
      if (within(d)) times.push(d!.getTime());
    })
  );
  if (!times.length) return null;

  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const daily = Math.round((maxT - minT) / 86400000) + 1 <= 62;
  const keyOf = daily
    ? (d: Date) => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()
    : (d: Date) => d.getFullYear() + '-' + d.getMonth();
  const labOf = daily
    ? (d: Date) => d.getDate() + ' ' + MONTH_ID3[d.getMonth()]
    : (d: Date) => MONTH_ID3[d.getMonth()] + " '" + String(d.getFullYear()).slice(2);

  const order: string[] = [];
  const repT: Record<string, number> = {};
  const labMap: Record<string, string> = {};
  const ensure = (d: Date) => {
    const k = keyOf(d);
    if (repT[k] == null) {
      repT[k] = d.getTime();
      order.push(k);
      labMap[k] = labOf(d);
    }
    return k;
  };

  const counts: Record<string, number>[] = sets.map(() => ({}));
  sets.forEach((s, si) =>
    (s.rows || []).forEach((r) => {
      const d = parseDate(r[s.dateKey]);
      if (!within(d)) return;
      const k = ensure(d!);
      counts[si][k] = (counts[si][k] || 0) + 1;
    })
  );
  order.sort((a, b) => repT[a] - repT[b]);

  return {
    labels: order.map((k) => labMap[k]),
    seriesList: counts.map((c) => order.map((k) => c[k] || 0)),
    names: sets.map((s) => s.name),
    daily
  };
}
