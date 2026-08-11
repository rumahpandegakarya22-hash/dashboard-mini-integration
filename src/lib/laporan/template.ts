import fs from 'node:fs';
import path from 'node:path';
import type { LabaRugiItem, ArusKasItem, NeracaItem } from './generator';

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

function periodeLabel(periode: string): string {
  // periode = 'YYYY-MM'
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
  .judul-laporan { font-size: 14pt; font-weight: 700; text-align: right; }
  .periode-laporan { font-size: 10pt; color: ${W.abu}; text-align: right; margin-top: 1mm; }
  .konten { flex: 1; }
  h2.seksi { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
             color: ${W.aksen}; margin: 5mm 0 2mm; padding: 2mm 3mm; background: #e8f0ec; border-radius: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { text-align: left; font-weight: 600; padding: 2mm 3mm; border-bottom: 1.5px solid ${W.garis};
       font-size: 8.5pt; color: ${W.abu}; }
  td { padding: 1.8mm 3mm; border-bottom: 1px solid ${W.garis}; }
  td.angka { text-align: right; }
  tr.sub-total td { font-weight: 600; background: #f0f0ec; }
  tr.total-bersih td { font-weight: 700; background: ${W.aksen}; color: #fff; font-size: 10pt; }
  tr.total-bersih td.angka { color: #fff; }
  tr.laba td { background: #dff0e8; font-weight: 700; }
  tr.rugi td { background: #f9e8e8; font-weight: 700; }
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

export function htmlLabaRugi(items: LabaRugiItem[], periode: string, generatedBy: string): string {
  const pendapatan = items.filter((i) => i.tipe === 'Pendapatan');
  const beban = items.filter((i) => i.tipe === 'Beban');
  const totalPendapatan = pendapatan.reduce((s, i) => s + i.total, 0);
  const totalBeban = beban.reduce((s, i) => s + i.total, 0);
  const netto = totalPendapatan - totalBeban;

  const rowsPendapatan = pendapatan.map((i) =>
    `<tr><td>${i.nama_akun}</td><td class="angka">${rp(i.total)}</td></tr>`
  ).join('');

  const rowsBeban = beban.map((i) =>
    `<tr><td>${i.nama_akun}</td><td class="angka">${rp(i.total)}</td></tr>`
  ).join('');

  const nettoClass = netto >= 0 ? 'laba' : 'rugi';
  const nettoLabel = netto >= 0 ? 'Laba Bersih' : 'Rugi Bersih';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${gaya()}</style></head><body>
<div class="halaman">
  ${header('Laporan Laba Rugi', periode)}
  <div class="konten">
    <h2 class="seksi">Pendapatan</h2>
    <table>
      <thead><tr><th>Akun</th><th style="text-align:right">Jumlah</th></tr></thead>
      <tbody>
        ${rowsPendapatan || '<tr><td colspan="2" style="color:#999">Tidak ada data</td></tr>'}
        <tr class="sub-total"><td>Total Pendapatan</td><td class="angka">${rp(totalPendapatan)}</td></tr>
      </tbody>
    </table>

    <h2 class="seksi">Beban</h2>
    <table>
      <thead><tr><th>Akun</th><th style="text-align:right">Jumlah</th></tr></thead>
      <tbody>
        ${rowsBeban || '<tr><td colspan="2" style="color:#999">Tidak ada data</td></tr>'}
        <tr class="sub-total"><td>Total Beban</td><td class="angka">${rp(totalBeban)}</td></tr>
      </tbody>
    </table>

    <table style="margin-top:4mm">
      <tbody>
        <tr class="${nettoClass}">
          <td>${nettoLabel}</td>
          <td class="angka">${rp(Math.abs(netto))}</td>
        </tr>
      </tbody>
    </table>
  </div>
  ${footer(generatedBy)}
</div>
</body></html>`;
}

export function htmlArusKas(items: ArusKasItem[], periode: string, generatedBy: string): string {
  const kategoriUrutan = ['Operasional', 'Investasi', 'Pendanaan'];
  const sorted = [...kategoriUrutan.map((k) => items.find((i) => i.kategori === k)).filter((i): i is ArusKasItem => !!i),
    ...items.filter((i) => !kategoriUrutan.includes(i.kategori))];

  const totalNet = sorted.reduce((s, i) => s + i.net, 0);

  const rows = sorted.map((i) => `
    <tr><td>Arus Masuk (${i.kategori})</td><td class="angka">${rp(i.inflow)}</td></tr>
    <tr><td>Arus Keluar (${i.kategori})</td><td class="angka">(${rp(i.outflow)})</td></tr>
    <tr class="sub-total"><td>Net ${i.kategori}</td><td class="angka">${rp(i.net)}</td></tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${gaya()}</style></head><body>
<div class="halaman">
  ${header('Laporan Arus Kas', periode)}
  <div class="konten">
    <table>
      <thead><tr><th>Keterangan</th><th style="text-align:right">Jumlah</th></tr></thead>
      <tbody>
        ${rows || '<tr><td colspan="2" style="color:#999">Tidak ada data</td></tr>'}
        <tr class="total-bersih"><td>Total Kenaikan/(Penurunan) Kas Bersih</td><td class="angka">${rp(totalNet)}</td></tr>
      </tbody>
    </table>
  </div>
  ${footer(generatedBy)}
</div>
</body></html>`;
}

export function htmlNeraca(items: NeracaItem[], periode: string, generatedBy: string): string {
  const aset = items.filter((i) => i.tipe_akun === 'Aset');
  const liabEkuitas = items.filter((i) => i.tipe_akun === 'Liabilitas' || i.tipe_akun === 'Ekuitas');
  const totalAset = aset.reduce((s, i) => s + i.saldo, 0);
  const totalLE = liabEkuitas.reduce((s, i) => s + i.saldo, 0);

  function grupRows(list: NeracaItem[]): string {
    const grupMap = new Map<string, NeracaItem[]>();
    for (const i of list) {
      const g = i.grup_laporan ?? i.tipe_akun;
      if (!grupMap.has(g)) grupMap.set(g, []);
      grupMap.get(g)!.push(i);
    }
    let out = '';
    for (const [grup, rows] of grupMap) {
      out += `<tr><td colspan="2" style="font-weight:600;font-size:8.5pt;color:${W.abu};padding-top:3mm">${grup}</td></tr>`;
      for (const r of rows) {
        out += `<tr><td style="padding-left:6mm">${r.nama_akun}</td><td class="angka">${rp(r.saldo)}</td></tr>`;
      }
    }
    return out;
  }

  const selisih = totalAset - totalLE;
  const validasiRow = Math.abs(selisih) < 1
    ? ''
    : `<tr><td colspan="2" style="color:red;font-size:8pt;padding-top:2mm">
        ⚠ Selisih Aset vs Liabilitas+Ekuitas: ${rp(selisih)}
       </td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${gaya()}</style></head><body>
<div class="halaman">
  ${header('Neraca (Balance Sheet)', periode)}
  <div class="konten" style="display:grid;grid-template-columns:1fr 1fr;gap:8mm">
    <div>
      <h2 class="seksi">Aset</h2>
      <table>
        <thead><tr><th>Akun</th><th style="text-align:right">Saldo</th></tr></thead>
        <tbody>
          ${grupRows(aset) || '<tr><td colspan="2" style="color:#999">Tidak ada data</td></tr>'}
          <tr class="sub-total"><td>Total Aset</td><td class="angka">${rp(totalAset)}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <h2 class="seksi">Liabilitas &amp; Ekuitas</h2>
      <table>
        <thead><tr><th>Akun</th><th style="text-align:right">Saldo</th></tr></thead>
        <tbody>
          ${grupRows(liabEkuitas) || '<tr><td colspan="2" style="color:#999">Tidak ada data</td></tr>'}
          <tr class="sub-total"><td>Total Liabilitas &amp; Ekuitas</td><td class="angka">${rp(totalLE)}</td></tr>
          ${validasiRow}
        </tbody>
      </table>
    </div>
  </div>
  ${footer(generatedBy)}
</div>
</body></html>`;
}
