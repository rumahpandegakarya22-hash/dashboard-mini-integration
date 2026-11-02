import { cssFont } from '@/lib/invoice/pdf';

const CSS_DOKUMEN = `
  @page { size: A4; margin: 72pt; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; margin: 0; }
  h1, h2, h3 { margin: 0 0 6pt; }
  p { margin: 0 0 6pt; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; }
  th, td { border: 1pt solid #000; padding: 3pt 5pt; text-align: left; vertical-align: top; }
  th { background: #d9e2f3; }
  tr { page-break-inside: avoid; }
`;

const CSS_OWNER = `
  @page { size: A4; margin: 54pt; }
  * { box-sizing: border-box; }
  body { font-family: 'Lato', Arial, sans-serif; font-size: 10.5pt; color: #33302f; margin: 0; }
  h1, h2, h3 { font-family: 'Poppins', Arial, sans-serif; color: #9e2227; margin: 0 0 6pt; }
  p { margin: 0 0 6pt; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; }
  th, td { border-bottom: 1pt solid #e3d9d7; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f8e9e9; color: #c92d31; font-family: 'Poppins', Arial, sans-serif; font-weight: 500; }
  tr { page-break-inside: avoid; }
`;

export function kerangkaDokumen(isi: string, tema: 'dokumen' | 'owner'): string {
  const css = tema === 'owner' ? cssFont() + CSS_OWNER : CSS_DOKUMEN;
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><style>${css}</style></head><body>${isi}</body></html>`;
}
