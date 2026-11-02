import { namaBulan } from './periode';

export function rupiah(n: number): string {
  const teks = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}Rp${teks}`;
}

export function tglPendek(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function tglPanjang(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${namaBulan(m)} ${y}`;
}

export function waktuWib(d: Date, denganJam: boolean): string {
  const bagian = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map(p => [p.type, p.value]),
  );
  const tgl = `${bagian.day}/${bagian.month}/${bagian.year}`;
  return denganJam ? `${tgl} ${bagian.hour}:${bagian.minute}` : tgl;
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

// Tanggal dari kolom teks DB: ISO -> dd/mm/yyyy, kosong -> '-', lainnya apa adanya (belum di-escape).
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
  const s = createdAt.trim();
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s.replace(' ', 'T') : `${s.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? s : waktuWib(d, true);
}
