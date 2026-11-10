import { bagianWib, fmtTanggal, fmtTeks, fmtWaktu } from '../format-tanggal';

/** Teks bebas (keterangan, dsb.) dengan tanggal ISO di dalamnya diubah ke format tampilan. */
export const teksTgl = fmtTeks;

export function rupiah(n: number): string {
  const teks = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}Rp${teks}`;
}

// Format tampilan tunggal "26 Sep 2026" (lihat lib/format-tanggal).
export function tglPendek(iso: string): string {
  return fmtTanggal(iso);
}

export function tglPanjang(iso: string): string {
  return fmtTanggal(iso);
}

export function waktuWib(d: Date, denganJam: boolean): string {
  return denganJam ? fmtWaktu(d) : fmtTanggal(d);
}

/** Tanggal (WIB) bentuk ISO untuk perbandingan, bukan untuk ditampilkan. */
export function isoWib(d: Date): string {
  const b = bagianWib(d);
  return `${b.y}-${String(b.m0 + 1).padStart(2, '0')}-${String(b.d).padStart(2, '0')}`;
}

export function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ISO_AWAL = /^\d{4}-\d{2}-\d{2}/;

// Tanggal dari kolom teks DB: ISO -> "26 Sep 2026", kosong -> '-', lainnya apa adanya (belum di-escape).
export function tglMentah(v: unknown): string {
  if (v === null || v === undefined) return '-';
  const s = String(v).trim();
  if (!s) return '-';
  return ISO_AWAL.test(s) ? tglPendek(s) : s;
}

// Versi aman untuk langsung dicetak ke HTML.
export function tgl(v: unknown): string {
  return esc(tglMentah(v));
}

// encodeURIComponent membiarkan ' ( ) * yang bukan attr-char RFC 5987, jadi di-encode manual.
export function rfc5987(s: string): string {
  return encodeURIComponent(s).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// created_at SQLite = 'YYYY-MM-DD HH:MM:SS' dalam UTC tanpa penanda zona; tampilkan sebagai WIB.
export function waktuRiwayatWib(createdAt: string): string {
  return fmtWaktu(createdAt, createdAt);
}
