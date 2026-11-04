import { cssFont } from '@/lib/invoice/pdf';

// Gaya dasar ekspor Drive: judul h1, subjudul h2, bagian h3, semuanya regular dan rata kiri.
// !important diperlukan karena template memberi text-align:center inline pada h1/h2.
const CSS_DASAR = `
  @page { size: A4; margin: 72pt; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 0; }
  h1, h2, h3 { font-weight: 400; text-align: left !important; line-height: 1.15; page-break-after: avoid; }
  h1 { font-size: 26pt; margin: 0 0 3pt; }
  h2 { font-size: 15pt; color: #666; margin: 0 0 16pt; }
  p { margin: 0; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; }
  th, td { border: 1pt solid #000; padding: 5pt; text-align: left; vertical-align: top; }
  tr { page-break-inside: avoid; }
`;

// Keluarga Pekerjaan: bagian 20 pt, sel 11 pt, header biru muda.
const CSS_DOKUMEN = `${CSS_DASAR}
  h3 { font-size: 20pt; margin: 20pt 0 6pt; }
  th { background: #d9e2f3; }
  h2 + p + p { padding-bottom: 8pt; border-bottom: 1px solid #808080; margin-bottom: 11pt; }
`;

// Keluarga Kerja/Kinerja: bagian 16 pt, sel 9 pt, header tanpa latar.
const CSS_KINERJA = `${CSS_DASAR}
  h3 { font-size: 16pt; margin: 18pt 0 6pt; }
  th, td { font-size: 9pt; }
  h2 + p { padding-bottom: 8pt; border-bottom: 1px solid #808080; margin-bottom: 11pt; }
`;

const CSS_OWNER = `
  @page { size: A4; margin: 54pt; }
  * { box-sizing: border-box; }
  body { font-family: 'Lato', Arial, sans-serif; font-size: 10.5pt; color: #33302f; margin: 0; }
  h1, h2, h3 { font-family: 'Poppins', Arial, sans-serif; font-weight: 700; margin: 0; page-break-after: avoid; }
  h1 { background: #c92d31; color: #fff; text-align: center; font-size: 16pt; padding: 14pt 16pt; margin-bottom: 10pt; }
  h2 { color: #9e2227; font-size: 15pt; margin: 14pt 0 6pt; }
  h2[style] { font-size: 22pt; margin: 10pt 0 2pt; }
  h3 { color: #c92d31; font-size: 12pt; margin: 8pt 0 4pt; }
  p { margin: 0 0 6pt; }
  h2[style] + p { font-size: 12pt; font-weight: 700; margin: 0; }
  h2[style] + p + p { font-size: 9pt; font-style: italic; color: #7a7170; padding-bottom: 12pt; border-bottom: 1px solid #808080; margin-bottom: 8pt; }
  p[style*="font-size"] { font-style: italic; color: #7a7170; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; }
  th, td { border: 1pt solid #e3d9d7; padding: 6pt 9pt; text-align: left; vertical-align: top; }
  th { background: #9e2227; color: #fff; font-family: 'Poppins', Arial, sans-serif; font-weight: 700; }
  tr { page-break-inside: avoid; }
  .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 8pt; margin: 8pt 0 12pt; }
  .kartu { border: 1pt solid #e3d9d7; border-radius: 6pt; padding: 8pt 10pt; background: #fbf7f6; page-break-inside: avoid; }
  .k4 { grid-column: span 4; } .k3 { grid-column: span 3; }
  .k-label { font-size: 8.5pt; color: #7a7170; text-transform: uppercase; letter-spacing: .4pt; }
  .k-nilai { font-family: 'Poppins', Arial, sans-serif; font-weight: 700; font-size: 14pt; margin: 3pt 0 5pt; white-space: nowrap; }
  .k3 .k-nilai { font-size: 12pt; }
  .k-bawah { display: flex; align-items: center; gap: 5pt; }
  .k-ket { font-size: 7.5pt; color: #7a7170; }
  .pil { display: inline-flex; align-items: center; gap: 3pt; border-radius: 10pt; padding: 1.5pt 6pt; font-size: 8pt; font-weight: 700; }
  .pil-baik { background: #e3f4e8; color: #1b7f3b; }
  .pil-buruk { background: #fbe3e1; color: #b3261e; }
  .pil-netral { background: #ece7e6; color: #7a7170; }
  .donuts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt; }
  .donut { border: 1pt solid #e3d9d7; border-radius: 6pt; padding: 8pt; text-align: center; page-break-inside: avoid; }
  .d-judul { font-family: 'Poppins', Arial, sans-serif; font-weight: 700; font-size: 10pt; color: #9e2227; margin-bottom: 4pt; }
  .lg { display: flex; gap: 5pt; text-align: left; font-size: 8pt; margin-top: 4pt; line-height: 1.25; }
  .lg-warna { flex: none; width: 8pt; height: 8pt; border-radius: 2pt; margin-top: 2pt; }
  .lg-kosong { font-size: 8pt; color: #7a7170; margin-top: 6pt; }
  .catatan { font-size: 8pt; color: #7a7170; margin-top: 8pt; }
`;

export type TemaDokumen = 'dokumen' | 'kinerja' | 'owner';

// Dokumen cetak selalu terang: tanpa ini pratinjau di browser mode gelap berlatar gelap dengan teks gelap.
const CSS_TERANG = `:root { color-scheme: light; } html, body { background: #fff; }`;

export function kerangkaDokumen(isi: string, tema: TemaDokumen): string {
  const css = CSS_TERANG + (tema === 'owner' ? cssFont() + CSS_OWNER : tema === 'kinerja' ? CSS_KINERJA : CSS_DOKUMEN);
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><style>${css}</style></head><body>${isi}</body></html>`;
}
