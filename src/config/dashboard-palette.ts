/* =========================================================================
   Palet & gradien Dashboard — PORT VERBATIM dari `G`, `PAL`, dan konstanta
   `barStops*` di public/app.js (Fase 4).

   Nilai warna TIDAK diubah sedikit pun (R8). Palet Owner sengaja memakai
   Brand Identity Guideline Kost Tiga Dara (crimson/dusty rose/charcoal/blush),
   BUKAN biru seperti divisi lain.
   ========================================================================= */

/** Gradien latar scorecard per divisi. */
export const G = {
  adminGreen: 'linear-gradient(150deg,#cfe9a8,#3fae84)',
  adminCyan: 'linear-gradient(150deg,#aee6df,#3aa0c4)',
  adminOlive: 'linear-gradient(150deg,#cfe08a,#7c8a3a)',
  adminDarkO: 'linear-gradient(150deg,#8c9a52,#3f4a2a)',
  adminDarkG: 'linear-gradient(150deg,#6fae8a,#2f4a3a)',

  mkLeads: 'linear-gradient(150deg,#f1a896,#e26d6d)',
  mkSurvey: 'linear-gradient(150deg,#c9a98f,#7a5f4f)',
  mkConv: 'linear-gradient(150deg,#e88ab0,#c0397a)',
  mkUnit: 'linear-gradient(150deg,#ecd07a,#c79a2a)',
  mkCac: 'linear-gradient(150deg,#d8c4ee,#a98fd0)',

  opRed: 'linear-gradient(150deg,#e8806f,#c0473a)',
  opOrange: 'linear-gradient(150deg,#ec8a5f,#c75f2a)',
  opTeal: 'linear-gradient(150deg,#7fd6c7,#2f8f9a)',
  opAmber: 'linear-gradient(150deg,#ecc27a,#c7872a)',
  opGreen: 'linear-gradient(150deg,#9ad68a,#4a8a3a)',
  opYellow: 'linear-gradient(150deg,#ecd87a,#c7a02a)',
  opTeal2: 'linear-gradient(150deg,#7fd6b7,#2f9a7a)',

  // charcoal→rose→blush
  ownPrimary: 'linear-gradient(135deg,#3A3635 0%,#CF7B72 65%,#F2D5CF 100%)',
  ownRose: 'linear-gradient(150deg,#3A3635,#CF7B72)',
  ownGray: 'linear-gradient(150deg,#3A3635,#8E8B87)',

  salePink: 'linear-gradient(150deg,#f3cdd0,#e89aa0)',
  saleRed: 'linear-gradient(150deg,#f0a0a8,#d0506a)',
  saleGold: 'linear-gradient(150deg,#ecc99a,#c79a5a)',
  salePeach: 'linear-gradient(150deg,#f0b89a,#d07a5a)'
} as const;

/** Palet donut per divisi (sesuai colour guideline tiap halaman). */
export const PAL: Record<string, string[]> = {
  admin: ['#6ad17f', '#4ed7c7', '#c7d86a'],
  marketing: ['#e26d6d', '#c0397a', '#ecd07a', '#a98fd0'],
  operasional: ['#c0473a', '#ec8a5f', '#2f8f9a'],
  // dusty rose, blush, warm gray, crimson (prioritas brand)
  owner: ['#CF7B72', '#F2D5CF', '#8E8B87', '#C92D31'],
  sales: ['#e89aa0', '#d0506a', '#c79a5a']
};

/** Warna legenda bar Owner. */
export const OWN_BAR = '#CF7B72';
