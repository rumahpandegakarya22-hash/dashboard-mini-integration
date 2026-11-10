/* Satu-satunya format tanggal yang tampil ke pengguna: "26 Sep 2026" (DD MMM YYYY, bulan Indonesia).
   Isi database tetap ISO (YYYY-MM-DD) supaya urutan, filter periode, dan laporan keuangan benar —
   file ini hanya mengubah TAMPILAN. Murni (tanpa dependensi) sehingga aman dipakai di server & klien. */

export const BULAN_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const dua = (n: number) => String(n).padStart(2, '0');
export const susun = (hari: number, bulan0: number, tahun: number) => `${dua(hari)} ${BULAN_3[bulan0]} ${tahun}`;

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Bagian tanggal/jam di zona WIB (Asia/Jakarta) dari sebuah instan waktu. */
export function bagianWib(d: Date): { y: number; m0: number; d: number; jam: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(d).map((x) => [x.type, x.value])
  );
  return { y: Number(p.year), m0: Number(p.month) - 1, d: Number(p.day), jam: `${p.hour}:${p.minute}` };
}

/**
 * Tanggal tanpa zona waktu ("2026-09-26", "2026-09-26 10:00") dibaca apa adanya (tidak digeser zona).
 * Date / angka epoch (detik atau milidetik) / string ber-zona dikonversi ke WIB.
 * Selain itu (kosong, teks bebas) dikembalikan `kosong` atau teks aslinya.
 */
export function fmtTanggal(v: unknown, kosong = '-'): string {
  if (v === null || v === undefined || v === '') return kosong;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? kosong : tampil(bagianWib(v));
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return kosong;
    return tampil(bagianWib(new Date(v < 1e11 ? v * 1000 : v)));
  }
  const s = String(v).trim();
  const m = ISO.exec(s);
  if (!m) return s || kosong;
  if (m[6]) return tampil(bagianWib(new Date(s.replace(' ', 'T'))));
  return susun(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

const tampil = (b: { y: number; m0: number; d: number }) => susun(b.d, b.m0, b.y);

/** Tanggal + jam WIB: "26 Sep 2026 14:30". String tanpa zona dianggap UTC (created_at SQLite). */
export function fmtWaktu(v: unknown, kosong = '-'): string {
  if (v === null || v === undefined || v === '') return kosong;
  let d: Date;
  if (v instanceof Date) d = v;
  else if (typeof v === 'number') d = new Date(v < 1e11 ? v * 1000 : v);
  else {
    const s = String(v).trim();
    const m = ISO.exec(s);
    if (!m) return s || kosong;
    if (!m[4]) return fmtTanggal(s, kosong);
    d = new Date(m[6] ? s.replace(' ', 'T') : `${s.replace(' ', 'T')}Z`);
  }
  if (Number.isNaN(d.getTime())) return kosong;
  const b = bagianWib(d);
  return `${susun(b.d, b.m0, b.y)} ${b.jam}`;
}

/** Ubah setiap tanggal ISO di dalam teks bebas (mis. keterangan jurnal "… [s/d 2026-06-30]") ke format tampilan. */
export function fmtTeks(teks: string): string {
  return teks.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) => susun(Number(d), Number(m) - 1, Number(y)));
}

/** "26 Sep 2026 – 26 Okt 2026" */
export function fmtRentang(a: unknown, b: unknown): string {
  return `${fmtTanggal(a)} – ${fmtTanggal(b)}`;
}

/** Tanggal hari ini (WIB) dalam format ISO, untuk nilai default input. */
export function hariIniIso(): string {
  const b = bagianWib(new Date());
  return `${b.y}-${dua(b.m0 + 1)}-${dua(b.d)}`;
}
