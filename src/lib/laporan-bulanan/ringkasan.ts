import type { LaporanTable } from '@/lib/laporan/generator';
import { esc, rupiah } from './format';
import { parsePeriode } from './periode';
import type { Periode } from './types';

export interface MetrikBulan {
  pendapatan: number; beban: number; laba: number; diskon: number;
  kamarIsi: number; kamarKosong: number; okupansi: number;
}
export interface Segmen { label: string; nilai: number }
export interface Ringkasan {
  kini: MetrikBulan;
  lalu: MetrikBulan;
  labelLalu: string;
  opex: Segmen[];
  income: Segmen[];
  totalKamar: number;
}

export function periodeLalu(p: Periode): Periode {
  const [y, m] = p.kode.split('-').map(Number);
  const kode = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  return parsePeriode(kode, new Date(p.sampai));
}

export function metrikBulan(
  lr: { pendapatan: number; beban: number; laba: number },
  diskon: number, kamarIsi: number, totalKamar: number,
): MetrikBulan {
  return {
    ...lr, diskon, kamarIsi,
    kamarKosong: Math.max(0, totalKamar - kamarIsi),
    okupansi: totalKamar > 0 ? Math.round((kamarIsi / totalKamar) * 1000) / 10 : 0,
  };
}

export function labaRugiRingkas(lr: LaporanTable): { pendapatan: number; beban: number; laba: number } {
  const nilai = (label: string) => {
    const b = lr.baris.find(x => x.label === label);
    if (!b) throw new Error(`Baris "${label}" tidak ditemukan di Laba Rugi.`);
    return b.nilai ?? 0;
  };
  const pendapatan = nilai('Total Pendapatan');
  const laba = nilai('LABA BERSIH');
  return { pendapatan, beban: pendapatan - laba, laba };
}

// Baris rincian Laba Rugi: sebelum "Total Pendapatan" = income, sesudahnya (selain subtotal/seksi) = beban.
export function rincianLabaRugi(lr: LaporanTable): { income: Segmen[]; opex: Segmen[] } {
  const income: Segmen[] = [];
  const opex: Segmen[] = [];
  let sudahTotal = false;
  for (const b of lr.baris) {
    if (b.label === 'Total Pendapatan') { sudahTotal = true; continue; }
    if (b.seksi || b.bold || b.nilai == null) continue;
    (sudahTotal ? opex : income).push({ label: b.label, nilai: b.nilai });
  }
  return { income, opex };
}

/** Buang nilai <= 0, urut terbesar, gabungkan sisa di luar `maks` menjadi "Lainnya". */
export function gabungSegmen(segmen: Segmen[], maks = 6): Segmen[] {
  const urut = segmen.filter(s => s.nilai > 0).sort((a, b) => b.nilai - a.nilai || a.label.localeCompare(b.label));
  if (urut.length <= maks) return urut;
  const sisa = urut.slice(maks - 1).reduce((t, s) => t + s.nilai, 0);
  return [...urut.slice(0, maks - 1), { label: 'Lainnya', nilai: sisa }];
}

export type SatuanDelta = 'persen' | 'poin' | 'unit';

/** Selisih kini vs lalu. 'persen' tanpa pembanding (lalu = 0) -> null, bukan angka karangan. */
export function hitungDelta(kini: number, lalu: number, satuan: SatuanDelta): number | null {
  if (satuan === 'persen') return lalu === 0 ? null : ((kini - lalu) / Math.abs(lalu)) * 100;
  return kini - lalu;
}

const desimal = (n: number) => Math.abs(n).toFixed(1).replace('.', ',').replace(/,0$/, '');

function teksDelta(d: number, satuan: SatuanDelta): string {
  if (satuan === 'persen') return `${desimal(d)}%`;
  if (satuan === 'poin') return `${desimal(d)} poin`;
  return String(Math.abs(Math.round(d)));
}

// Teks di lubang donut sempit: Rp12.345.678 -> "Rp12,3 jt".
export function rupiahRingkas(n: number): string {
  const a = Math.abs(n);
  const tanda = n < 0 ? '-' : '';
  if (a >= 1e9) return `${tanda}Rp${desimal(a / 1e9)} M`;
  if (a >= 1e6) return `${tanda}Rp${desimal(a / 1e6)} jt`;
  return rupiah(n);
}

const SEGITIGA_NAIK = '<svg width="8" height="8" viewBox="0 0 8 8"><path d="M4 0L8 8H0Z" fill="currentColor"/></svg>';
const SEGITIGA_TURUN = '<svg width="8" height="8" viewBox="0 0 8 8"><path d="M0 0H8L4 8Z" fill="currentColor"/></svg>';

/** naikBaik: true bila kenaikan itu kabar baik (pendapatan), false bila buruk (beban, diskon, kamar kosong). */
export function pilHtml(d: number | null, satuan: SatuanDelta, naikBaik: boolean): string {
  if (d === null) return '<span class="pil pil-netral">–</span>';
  const nol = Math.abs(d) < 0.05;
  if (nol) return '<span class="pil pil-netral">Tetap</span>';
  const naik = d > 0;
  const kelas = naik === naikBaik ? 'pil-baik' : 'pil-buruk';
  return `<span class="pil ${kelas}">${naik ? SEGITIGA_NAIK : SEGITIGA_TURUN}${teksDelta(d, satuan)}</span>`;
}

const WARNA = ['#c92d31', '#e8777a', '#9e2227', '#7a7170', '#d9a5a2', '#f1d9d7'];

export function donutSvg(segmen: Segmen[], tengah: string): string {
  const total = segmen.reduce((t, s) => t + s.nilai, 0);
  const R = 52;
  const K = 2 * Math.PI * R;
  let isi = '';
  if (total <= 0) {
    isi = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="#e3d9d7" stroke-width="24"/>`;
  } else {
    let awal = 0;
    segmen.forEach((s, i) => {
      const panjang = (s.nilai / total) * K;
      isi += `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${WARNA[i % WARNA.length]}" stroke-width="24" stroke-dasharray="${panjang.toFixed(2)} ${(K - panjang).toFixed(2)}" stroke-dashoffset="${(-awal).toFixed(2)}" transform="rotate(-90 70 70)"/>`;
      awal += panjang;
    });
  }
  return `<svg width="130" height="130" viewBox="0 0 140 140">${isi}<text x="70" y="75" text-anchor="middle" font-size="13" font-weight="700" fill="#33302f">${esc(tengah)}</text></svg>`;
}

function legendaHtml(segmen: Segmen[], uang: boolean): string {
  const total = segmen.reduce((t, s) => t + s.nilai, 0);
  if (total <= 0) return '<div class="lg-kosong">Tidak ada data</div>';
  return segmen.map((s, i) => {
    const persen = desimal((s.nilai / total) * 100);
    const nilai = uang ? `${rupiah(s.nilai)} · ${persen}%` : `${s.nilai} · ${persen}%`;
    return `<div class="lg"><span class="lg-warna" style="background:${WARNA[i % WARNA.length]}"></span><span class="lg-teks">${esc(s.label)}<br><b>${nilai}</b></span></div>`;
  }).join('');
}

function donutKartu(judul: string, segmen: Segmen[], tengah: string, uang: boolean): string {
  return `<div class="donut"><div class="d-judul">${esc(judul)}</div>${donutSvg(segmen, tengah)}${legendaHtml(segmen, uang)}</div>`;
}

function kartu(label: string, nilai: string, pil: string, ket: string, lebar: 4 | 3): string {
  return `<div class="kartu k${lebar}"><div class="k-label">${esc(label)}</div><div class="k-nilai">${nilai}</div><div class="k-bawah">${pil}<span class="k-ket">${esc(ket)}</span></div></div>`;
}

export function ringkasanHtml(r: Ringkasan): string {
  const { kini: k, lalu: l } = r;
  const ket = 'vs bln lalu';
  const persen = (a: number, b: number, baik: boolean) => pilHtml(hitungDelta(a, b, 'persen'), 'persen', baik);
  const kartuAtas = [
    kartu('Pendapatan Neto', rupiah(k.pendapatan), persen(k.pendapatan, l.pendapatan, true), ket, 4),
    kartu('Laba Bersih', rupiah(k.laba), persen(k.laba, l.laba, true), ket, 4),
    kartu('OPEX', rupiah(k.beban), persen(k.beban, l.beban, false), ket, 4),
  ];
  const kartuBawah = [
    kartu('Total Diskon', rupiah(k.diskon), persen(k.diskon, l.diskon, false), ket, 3),
    kartu('Okupansi', `${desimal(k.okupansi)}%`, pilHtml(hitungDelta(k.okupansi, l.okupansi, 'poin'), 'poin', true), ket, 3),
    kartu('Kamar Isi', String(k.kamarIsi), pilHtml(hitungDelta(k.kamarIsi, l.kamarIsi, 'unit'), 'unit', true), ket, 3),
    kartu('Kamar Kosong', String(k.kamarKosong), pilHtml(hitungDelta(k.kamarKosong, l.kamarKosong, 'unit'), 'unit', false), ket, 3),
  ];
  const opex = gabungSegmen(r.opex);
  const income = gabungSegmen(r.income);
  const kamar = [
    { label: 'Terisi', nilai: k.kamarIsi },
    { label: 'Kosong', nilai: k.kamarKosong },
  ].filter(s => s.nilai > 0);
  return `<div class="grid">${kartuAtas.join('')}${kartuBawah.join('')}</div>
<div class="donuts">
${donutKartu('Komposisi OPEX', opex, rupiahRingkas(k.beban), true)}
${donutKartu('Komposisi Income', income, rupiahRingkas(k.pendapatan), true)}
${donutKartu('Status Kamar', kamar, `${r.totalKamar} kamar`, false)}
</div>
<p class="catatan">Pembanding: ${esc(r.labelLalu)}. Okupansi dan jumlah kamar dihitung pada akhir bulan laporan dari riwayat hunian.</p>`;
}
