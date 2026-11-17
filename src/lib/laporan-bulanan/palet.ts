/* Palet warna laporan per divisi. Sumber tunggal: src/config/dashboard-palette.ts (palet Dashboard),
   supaya laporan PDF dan halaman Dashboard satu divisi memakai warna yang sama. Owner Review
   tetap memakai palet merah brand miliknya sendiri. */

import { G, PAL } from '@/config/dashboard-palette';

export type TemaWarna = 'owner' | 'admin' | 'sales' | 'marketing' | 'operasional';

export interface Palet {
  /** Latar banner judul (boleh gradien). */
  banner: string;
  /** Warna judul bagian, kepala tabel, dan judul chart. */
  judul: string;
  /** Warna sub-bagian (h3). */
  h3: string;
  /** Enam warna donut dan legenda. */
  donut: string[];
  /** Tiga warna garis line chart. */
  seri: [string, string, string];
  /** Dua warna batang bar chart. */
  bar: [string, string];
  /** Latar kartu angka dan garis pembatas. */
  tint: string;
  garis: string;
}

/** Ambil warna-warna hex dari string gradien, mis. 'linear-gradient(150deg,#cfe9a8,#3fae84)' -> ['#cfe9a8', '#3fae84']. */
export function warnaGradien(g: string): string[] {
  return g.match(/#[0-9a-fA-F]{6}/g) ?? [];
}
const ujung = (g: string): string => warnaGradien(g).slice(-1)[0];

/** Campur warna hex dengan putih (bagian = porsi warna asli, 0..1). */
export function campurPutih(hex: string, bagian: number): string {
  const n = parseInt(hex.slice(1), 16);
  const kanal = (v: number) => Math.round(255 - (255 - v) * bagian).toString(16).padStart(2, '0');
  return `#${kanal((n >> 16) & 255)}${kanal((n >> 8) & 255)}${kanal(n & 255)}`;
}

function palet(o: { banner: string; judul: string; h3?: string; donut: string[]; seri: [string, string, string]; bar?: [string, string]; aksen: string }): Palet {
  return {
    banner: o.banner,
    judul: o.judul,
    h3: o.h3 ?? o.judul,
    donut: o.donut,
    seri: o.seri,
    bar: o.bar ?? [o.donut[0], o.donut[1]],
    tint: campurPutih(o.aksen, 0.07),
    garis: campurPutih(o.aksen, 0.3),
  };
}

export const PALET: Record<TemaWarna, Palet> = {
  // Brand Owner Review: sengaja tidak berubah.
  owner: {
    banner: '#c92d31', judul: '#9e2227', h3: '#c92d31',
    donut: ['#c92d31', '#e8777a', '#9e2227', '#7a7170', '#d9a5a2', '#f1d9d7'],
    seri: ['#c92d31', '#7a7170', '#e8a33a'], bar: ['#c92d31', '#e8777a'],
    tint: '#fbf7f6', garis: '#e3d9d7',
  },
  // Admin and Finance (hijau-cyan-olive). Banner dan judul memakai hijau tua agar teks putih terbaca.
  admin: palet({
    aksen: ujung(G.adminGreen),
    banner: `linear-gradient(150deg,${ujung(G.adminGreen)},${ujung(G.adminDarkG)})`,
    judul: ujung(G.adminDarkG),
    donut: [...PAL.admin, ujung(G.adminGreen), ujung(G.adminCyan), ujung(G.adminOlive)],
    seri: [ujung(G.adminGreen), ujung(G.adminCyan), ujung(G.adminOlive)],
  }),
  // Sales (rose-merah-emas).
  sales: palet({
    aksen: ujung(G.saleRed),
    banner: ujung(G.saleRed), judul: ujung(G.saleRed),
    donut: [...PAL.sales, ujung(G.salePeach), ujung(G.salePink), warnaGradien(G.saleGold)[0]],
    seri: [ujung(G.saleRed), ujung(G.saleGold), ujung(G.salePink)],
  }),
  // Marketing (coral-magenta-emas-lavender).
  marketing: palet({
    aksen: ujung(G.mkConv),
    banner: ujung(G.mkConv), judul: ujung(G.mkConv),
    donut: [...PAL.marketing, ujung(G.mkUnit), ujung(G.mkSurvey)],
    seri: [ujung(G.mkConv), PAL.marketing[0], ujung(G.mkUnit)],
  }),
  // Operasional (merah bata-oranye-teal).
  operasional: palet({
    aksen: ujung(G.opRed),
    banner: ujung(G.opRed), judul: ujung(G.opRed),
    donut: [...PAL.operasional, ujung(G.opAmber), ujung(G.opGreen), ujung(G.opOrange)],
    seri: [ujung(G.opRed), ujung(G.opTeal), PAL.operasional[1]],
  }),
};

/** Deklarasi variabel CSS yang dibaca chart (donut, bar, line). */
export function variabelCss(p: Palet): string {
  const d = p.donut.map((w, i) => `--d${i}: ${w};`).join(' ');
  const s = p.seri.map((w, i) => `--s${i + 1}: ${w};`).join(' ');
  return `:root { ${d} ${s} --b1: ${p.bar[0]}; --b2: ${p.bar[1]}; --garis: ${p.garis}; }`;
}
