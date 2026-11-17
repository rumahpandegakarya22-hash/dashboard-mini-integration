/* Grafik laporan bulanan divisi: donut (dari ringkasan.ts), bar, dan line berupa SVG inline,
   dengan palet dan gaya yang sama dengan Owner Review. Murni: tanpa database. */

import { esc } from './format';
import { donutKartu, rupiahRingkas, type Segmen } from './ringkasan';
import type { Periode } from './types';

export { donutKartu, type Segmen };

export interface Titik { label: string; nilai: number }
export interface Seri { nama: string; warna: string; titik: Titik[] }

const angkaId = (n: number) => (Math.round(n * 10) / 10).toLocaleString('id-ID');
const fmt = (n: number, uang: boolean) => (uang ? rupiahRingkas(n) : angkaId(n));

const KOSONG = '<div class="c-kosong">Belum ada data pada periode ini</div>';

/** Hitung kemunculan tiap nilai, buang kosong, urut terbanyak; sisa di luar `maks` digabung "Lainnya". */
export function hitungKemunculan(nilai: (string | null | undefined)[], maks = 7): Titik[] {
  const peta = new Map<string, number>();
  for (const v of nilai) {
    const k = v?.trim();
    if (k) peta.set(k, (peta.get(k) ?? 0) + 1);
  }
  const urut = [...peta].map(([label, n]) => ({ label, nilai: n })).sort((a, b) => b.nilai - a.nilai || a.label.localeCompare(b.label));
  if (urut.length <= maks) return urut;
  const sisa = urut.slice(maks - 1).reduce((t, x) => t + x.nilai, 0);
  return [...urut.slice(0, maks - 1), { label: 'Lainnya', nilai: sisa }];
}

/** Jumlahkan nilai per kunci teks (mis. biaya per lokasi), urut terbesar, buang total <= 0. */
export function jumlahPerKunci(baris: { kunci: string | null | undefined; nilai: number }[], maks = 7): Titik[] {
  const peta = new Map<string, number>();
  for (const b of baris) {
    const k = b.kunci?.trim() || 'Lainnya';
    peta.set(k, (peta.get(k) ?? 0) + b.nilai);
  }
  const urut = [...peta].map(([label, n]) => ({ label, nilai: n })).filter(x => x.nilai > 0).sort((a, b) => b.nilai - a.nilai || a.label.localeCompare(b.label));
  if (urut.length <= maks) return urut;
  const sisa = urut.slice(maks - 1).reduce((t, x) => t + x.nilai, 0);
  return [...urut.slice(0, maks - 1), { label: 'Lainnya', nilai: sisa }];
}

export function segmenDari(titik: Titik[]): Segmen[] {
  return titik.map(t => ({ label: t.label, nilai: t.nilai }));
}

/** Semua tanggal ISO dari awal sampai akhir periode. */
export function hariDalamPeriode(p: Pick<Periode, 'dari' | 'sampai'>): string[] {
  const out: string[] = [];
  const [y, m, d] = p.dari.split('-').map(Number);
  let t = Date.UTC(y, m - 1, d);
  const akhir = Date.parse(`${p.sampai}T00:00:00Z`);
  while (t <= akhir && out.length < 366) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86_400_000;
  }
  return out;
}

/** Jumlah nilai per hari di periode (label = tanggal 1-31). Baris di luar periode atau bertanggal rusak diabaikan. */
export function perHari(baris: { tanggal: string; nilai?: number }[], p: Pick<Periode, 'dari' | 'sampai'>): Titik[] {
  const hari = hariDalamPeriode(p);
  const total = new Map(hari.map(h => [h, 0]));
  for (const b of baris) {
    const k = (b.tanggal ?? '').slice(0, 10);
    if (total.has(k)) total.set(k, (total.get(k) ?? 0) + (b.nilai ?? 1));
  }
  return hari.map(h => ({ label: String(Number(h.slice(8, 10))), nilai: total.get(h) ?? 0 }));
}

/** Jumlah per blok 7 hari (tanggal 1-7, 8-14, ...), lebih terbaca daripada harian untuk data jarang. */
export function perMinggu(baris: { tanggal: string; nilai?: number }[], p: Pick<Periode, 'dari' | 'sampai'>): Titik[] {
  const hari = hariDalamPeriode(p);
  const blok = Math.ceil(hari.length / 7);
  const out: Titik[] = Array.from({ length: blok }, (_, i) => ({ label: `${i * 7 + 1}–${Math.min(hari.length, (i + 1) * 7)}`, nilai: 0 }));
  for (const b of baris) {
    const i = hari.indexOf((b.tanggal ?? '').slice(0, 10));
    if (i >= 0) out[Math.floor(i / 7)].nilai += b.nilai ?? 1;
  }
  return out;
}

/** Kartu angka ringkas (gaya Owner Review). `lebar` 4 = tiga per baris, 3 = empat per baris. */
export function kartuAngka(item: { label: string; nilai: string; ket?: string }[], lebar: 3 | 4 = 4): string {
  const isi = item.map(i =>
    `<div class="kartu k${lebar}"><div class="k-label">${esc(i.label)}</div><div class="k-nilai">${esc(i.nilai)}</div>${i.ket ? `<div class="k-bawah"><span class="k-ket">${esc(i.ket)}</span></div>` : ''}</div>`).join('');
  return `<div class="grid">${isi}</div>`;
}

export function barisDonut(kartu: string[]): string {
  return `<div class="donuts" style="grid-template-columns:repeat(${Math.max(1, kartu.length)},1fr)">${kartu.join('')}</div>`;
}

export function barisGrafik(kartu: string[]): string {
  return `<div class="charts">${kartu.join('')}</div>`;
}

const potong = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Bar horizontal: label di kiri, nilai di ujung batang. Cocok untuk label panjang dan banyak kategori. */
export function barKartu(judul: string, data: Titik[], opsi: { uang?: boolean; penuh?: boolean } = {}): string {
  const uang = !!opsi.uang;
  const ada = data.filter(d => d.nilai > 0);
  const kelas = opsi.penuh ? 'chart penuh' : 'chart';
  if (!ada.length) return `<div class="${kelas}"><div class="c-judul">${esc(judul)}</div>${KOSONG}</div>`;
  const maks = Math.max(...ada.map(d => d.nilai));
  const W = opsi.penuh ? 640 : 310;
  const labelW = opsi.penuh ? 150 : 100;
  const nilaiW = 62;
  const batangMaks = W - labelW - nilaiW - 6;
  const T = 20;
  const baris = ada.map((d, i) => {
    const y = 6 + i * T;
    const w = Math.max(2, (d.nilai / maks) * batangMaks);
    return `<text x="0" y="${y + 11}" font-size="9.5" fill="#33302f">${esc(potong(d.label, opsi.penuh ? 26 : 16))}</text>` +
      `<rect x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="13" rx="2" style="fill:var(--b${i % 2 === 0 ? 1 : 2})"/>` +
      `<text x="${(labelW + w + 4).toFixed(1)}" y="${y + 11}" font-size="9.5" font-weight="700" fill="#33302f">${esc(fmt(d.nilai, uang))}</text>`;
  }).join('');
  const H = 12 + ada.length * T;
  return `<div class="${kelas}"><div class="c-judul">${esc(judul)}</div><svg width="100%" viewBox="0 0 ${W} ${H}" font-family="Lato, Arial, sans-serif">${baris}</svg></div>`;
}

/** Bar vertikal untuk sedikit kategori yang dibandingkan (mis. kas masuk vs keluar). Boleh bernilai negatif. */
export function barVertikalKartu(judul: string, data: Titik[], opsi: { uang?: boolean } = {}): string {
  const uang = !!opsi.uang;
  if (!data.some(d => d.nilai !== 0)) return `<div class="chart"><div class="c-judul">${esc(judul)}</div>${KOSONG}</div>`;
  const W = 310, H = 170, padB = 30, padT = 16;
  const maks = Math.max(1, ...data.map(d => Math.abs(d.nilai)));
  const ch = H - padB - padT;
  const lebar = (W - 20) / data.length;
  const bw = Math.min(54, lebar * 0.55);
  const batang = data.map((d, i) => {
    const tinggi = Math.max(2, (Math.abs(d.nilai) / maks) * ch);
    const x = 10 + i * lebar + (lebar - bw) / 2;
    const y = padT + ch - tinggi;
    const warna = d.nilai < 0 ? '#7a7170' : `var(--b${i % 2 === 0 ? 1 : 2})`;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${tinggi.toFixed(1)}" rx="2" style="fill:${warna}"/>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" font-size="9" font-weight="700" text-anchor="middle" fill="#33302f">${esc(fmt(d.nilai, uang))}</text>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 12}" font-size="9" text-anchor="middle" fill="#7a7170">${esc(potong(d.label, 14))}</text>`;
  }).join('');
  return `<div class="chart"><div class="c-judul">${esc(judul)}</div><svg width="100%" viewBox="0 0 ${W} ${H}" font-family="Lato, Arial, sans-serif"><line x1="8" y1="${padT + ch}" x2="${W - 8}" y2="${padT + ch}" style="stroke:var(--garis)"/>${batang}</svg></div>`;
}

/** Pembulatan ke atas ke angka "bulat" (1, 2, 5 x 10^n) supaya sumbu mudah dibaca. */
export function batasAtas(maks: number): number {
  if (maks <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(maks));
  const f = maks / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
}

/** Line chart satu atau beberapa seri dengan sumbu x yang sama (mis. tanggal 1-31). */
export function garisKartu(judul: string, seri: Seri[], opsi: { uang?: boolean } = {}): string {
  const uang = !!opsi.uang;
  const n = Math.max(0, ...seri.map(s => s.titik.length));
  const semua = seri.flatMap(s => s.titik.map(t => t.nilai));
  if (n === 0 || !semua.some(v => v > 0)) return `<div class="chart penuh"><div class="c-judul">${esc(judul)}</div>${KOSONG}</div>`;

  const W = 640, H = 175, padL = 46, padR = 12, padT = 10, padB = 22;
  const cw = W - padL - padR;
  const ch = H - padT - padB;
  const atas = batasAtas(Math.max(...semua));
  const X = (i: number) => padL + (n === 1 ? cw / 2 : (i / (n - 1)) * cw);
  const Y = (v: number) => padT + ch - (v / atas) * ch;

  const grid = [0, 1, 2, 3, 4].map(k => {
    const v = (atas / 4) * k;
    const y = Y(v);
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" style="stroke:var(--garis)" stroke-width="0.6"/>` +
      `<text x="${padL - 5}" y="${(y + 3).toFixed(1)}" font-size="8.5" text-anchor="end" fill="#7a7170">${esc(fmt(v, uang))}</text>`;
  }).join('');

  const langkah = Math.max(1, Math.ceil(n / 16));
  const sumbuX = (seri[0]?.titik ?? []).map((t, i) =>
    i % langkah === 0 || i === n - 1
      ? `<text x="${X(i).toFixed(1)}" y="${H - 7}" font-size="8.5" text-anchor="middle" fill="#7a7170">${esc(t.label)}</text>`
      : '').join('');

  const garis = seri.map((s, k) => {
    const pts = s.titik.map((t, i) => `${X(i).toFixed(1)},${Y(t.nilai).toFixed(1)}`);
    const area = k === 0 && s.titik.length > 1
      ? `<polygon points="${X(0).toFixed(1)},${Y(0).toFixed(1)} ${pts.join(' ')} ${X(s.titik.length - 1).toFixed(1)},${Y(0).toFixed(1)}" style="fill:${s.warna};fill-opacity:0.12"/>`
      : '';
    const titik = n <= 31 ? s.titik.map((t, i) => (t.nilai > 0 ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(t.nilai).toFixed(1)}" r="1.9" style="fill:${s.warna}"/>` : '')).join('') : '';
    return `${area}<polyline points="${pts.join(' ')}" fill="none" style="stroke:${s.warna}" stroke-width="1.7" stroke-linejoin="round"/>${titik}`;
  }).join('');

  const legenda = seri.length > 1
    ? `<div class="ch-leg">${seri.map(s => `<span><i style="background:${s.warna}"></i>${esc(s.nama)}</span>`).join('')}</div>`
    : '';
  return `<div class="chart penuh"><div class="c-judul">${esc(judul)}</div><svg width="100%" viewBox="0 0 ${W} ${H}" font-family="Lato, Arial, sans-serif">${grid}${sumbuX}${garis}</svg>${legenda}</div>`;
}

/** Warna seri line chart: variabel CSS --s1..--s3 dari palet divisi (palet.ts). */
export const WARNA_SERI = { utama: 'var(--s1)', kedua: 'var(--s2)', ketiga: 'var(--s3)' };
