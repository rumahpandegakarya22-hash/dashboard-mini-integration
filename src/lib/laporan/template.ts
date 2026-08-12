import fs from 'node:fs';
import path from 'node:path';
import type { Baris, LaporanTable, NeracaTable } from './generator';

const W = {
  latar: '#f7f6f2',
  teks: '#3a3635',
  abu: '#8e8b86',
  garis: '#c9c5be',
  aksen: '#4a6c5c',
};

const NAMA_KOST = 'Kost Tiga Dara';
const ALAMAT = 'Jl. Pandega Karya No.22, Depok, Sleman DIY';

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function logoDataUri(): string | null {
  const p = path.join(process.cwd(), 'public', 'logo-kost.png');
  if (!fs.existsSync(p)) return null;
  return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
}

function blokLogo(): string {
  const uri = logoDataUri();
  return uri
    ? `<img class="logo" src="${uri}" alt="Logo Kost Tiga Dara">`
    : `<div class="logo-placeholder">LOGO</div>`;
}

export function rp(n: number): string {
  return 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
}

/** Format nilai baris: null → kosong, 0 → '-', negatif → (Rp…), positif → Rp… */
function fmt(n: number | null): string {
  if (n === null) return '';
  if (Math.round(n) === 0) return '-';
  return n < 0 ? `(${rp(n)})` : rp(n);
}

function periodeLabel(periode: string): string {
  const [y, m] = periode.split('-');
  const idx = parseInt(m, 10) - 1;
  return `${BULAN_ID[idx] ?? m} ${y}`;
}

function tanggalSekarang(): string {
  const d = new Date();
  return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function gaya(): string {
  return `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: ${W.latar}; color: ${W.teks};
         font-family: 'Segoe UI', system-ui, sans-serif;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .halaman { width: 210mm; min-height: 297mm; padding: 16mm 14mm 12mm; display: flex; flex-direction: column; }
  .kepala { display: flex; align-items: center; gap: 8mm; border-bottom: 2px solid ${W.aksen}; padding-bottom: 6mm; margin-bottom: 6mm; }
  .logo { width: 20mm; height: 20mm; object-fit: contain; }
  .logo-placeholder { width: 20mm; height: 20mm; border: 1.5px dashed ${W.abu}; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: 7pt; color: ${W.abu}; }
  .kepala-teks { flex: 1; }
  .nama-kost { font-size: 16pt; font-weight: 700; color: ${W.aksen}; line-height: 1.2; }
  .alamat-kost { font-size: 9pt; color: ${W.abu}; margin-top: 1mm; }
  .judul-laporan { font-size: 13pt; font-weight: 700; text-align: right; }
  .periode-laporan { font-size: 10pt; color: ${W.abu}; text-align: right; margin-top: 1mm; }
  .konten { flex: 1; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  td { padding: 1.6mm 3mm; border-bottom: 1px solid #eceae5; }
  td.angka { text-align: right; white-space: nowrap; }
  tr.seksi td { font-weight: 700; text-transform: uppercase; letter-spacing: .4px; font-size: 8.5pt;
                color: ${W.aksen}; background: #e8f0ec; padding-top: 2.5mm; padding-bottom: 2.5mm; }
  tr.total td { font-weight: 700; background: #f0f0ec; }
  tr.grand td { font-weight: 700; background: ${W.aksen}; color: #fff; font-size: 10.5pt; }
  .footer { margin-top: auto; padding-top: 6mm; border-top: 1px solid ${W.garis};
            font-size: 8pt; color: ${W.abu}; text-align: center; }
  `;
}

function header(judulLaporan: string, periode: string): string {
  return `
  <div class="kepala">
    ${blokLogo()}
    <div class="kepala-teks">
      <div class="nama-kost">${NAMA_KOST}</div>
      <div class="alamat-kost">${ALAMAT}</div>
    </div>
    <div>
      <div class="judul-laporan">${judulLaporan}</div>
      <div class="periode-laporan">Periode: ${periodeLabel(periode)}</div>
    </div>
  </div>`;
}

function footer(generatedBy: string): string {
  return `<div class="footer">Digenerate oleh sistem — ${tanggalSekarang()} &middot; ${generatedBy}</div>`;
}

/** Baris tabel: kelas 'grand' untuk baris LABA BERSIH / TOTAL / AKHIR. */
function barisRow(b: Baris): string {
  if (b.seksi) return `<tr class="seksi"><td colspan="2">${b.label}</td></tr>`;
  const grand = /^(LABA BERSIH|TOTAL ASET|TOTAL PASIVA|Arus Kas Akhir Periode)$/i.test(b.label);
  const cls = grand ? 'grand' : (b.bold ? 'total' : '');
  return `<tr class="${cls}"><td>${b.label}</td><td class="angka">${fmt(b.nilai)}</td></tr>`;
}

function halaman(judul: string, periode: string, isi: string, by: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${gaya()}</style></head><body>
<div class="halaman">
  ${header(judul, periode)}
  <div class="konten">${isi}</div>
  ${footer(by)}
</div>
</body></html>`;
}

export function htmlLabaRugi(report: LaporanTable, periode: string, by: string): string {
  const rows = report.baris.map(barisRow).join('');
  return halaman('Laporan Laba Rugi', periode, `<table><tbody>${rows}</tbody></table>`, by);
}

export function htmlArusKas(report: LaporanTable, periode: string, by: string): string {
  const rows = report.baris.map(barisRow).join('');
  return halaman('Laporan Arus Kas', periode, `<table><tbody>${rows}</tbody></table>`, by);
}

export function htmlNeraca(report: NeracaTable, periode: string, by: string): string {
  const kiri = report.sisi.kiri.map(barisRow).join('');
  const kanan = report.sisi.kanan.map(barisRow).join('');
  const isi = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
      <div><div style="font-weight:700;color:${W.aksen};margin-bottom:2mm">ASET (AKTIVA)</div>
        <table><tbody>${kiri}</tbody></table></div>
      <div><div style="font-weight:700;color:${W.aksen};margin-bottom:2mm">LIABILITAS &amp; EKUITAS (PASIVA)</div>
        <table><tbody>${kanan}</tbody></table></div>
    </div>`;
  return halaman('Laporan Posisi Keuangan (Neraca)', periode, isi, by);
}
