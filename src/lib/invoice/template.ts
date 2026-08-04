import fs from 'node:fs';
import path from 'node:path';
import { cssFont } from './pdf';
import type { InvoiceDp, InvoiceSewa } from './data';

/* ==========================================================================
   Template invoice — mengikuti desain "Template Invoice Pembayaran Sewa/DP"
   (Google Docs, A4). Warna diambil langsung dari PDF desain.

   HTML ini HANYA dipakai sebagai sumber render PDF (lihat pdf.ts), tidak lagi
   dikirim sebagai badan email. Karena itu boleh memakai CSS penuh, @page A4,
   dan font tertanam — hal-hal yang dulu dihindari demi kompatibilitas Gmail.

   Font: Lora untuk judul serif & nilai data (pengganti ArialMT pada desain
   asli, SemiBold 600), Poppins untuk label dan isi tabel.
   ========================================================================== */

const W = {
  latar: '#f7f6f2',
  teks: '#3a3635',
  abu: '#8e8b86',
  garis: '#c9c5be'
};

const ALAMAT = ['Jl. Pandega Karya No.22', 'Depok, Sleman DIY'];
const TELEPON = '(+62) 822 3334 3839';
const EMAIL_KONTAK = 'rumahpandegakarya22@gmail.com';

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Logo ditanam sebagai data URI dari public/logo-kost.png — aman karena target
 * akhirnya PDF, bukan email (Gmail memblokir data URI, Chromium tidak).
 * Selama file itu belum diganti dengan logo asli, yang tampil kotak placeholder.
 */
function logoDataUri(): string | null {
  const p = path.join(process.cwd(), 'public', 'logo-kost.png');
  if (!fs.existsSync(p)) return null;
  return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
}

function blokLogo(): string {
  const uri = logoDataUri();
  return uri
    ? `<img class="logo" src="${uri}" alt="Logo Kost Tiga Dara">`
    : `<div class="logo-placeholder">LOGO<br><span>public/logo-kost.png</span></div>`;
}

/** Watermark memakai berkas logo yang sama; dilewati kalau logo belum dipasang. */
function blokWatermark(): string {
  const uri = logoDataUri();
  if (!uri) return '';
  return `<img class="watermark w1" src="${uri}" alt=""><img class="watermark w2" src="${uri}" alt="">`;
}

function rp(n: number | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-Rp ' : 'Rp ') + Math.abs(v).toLocaleString('id-ID');
}

/** 'YYYY-MM-DD' → '4 Agustus 2026'. Tanggal kosong/rusak dikembalikan apa adanya. */
export function tanggalId(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/** Nilai dari database bisa memuat < atau & — di-escape supaya tidak merusak markup. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type Item = { nama: string; hargaUnit: string; jumlah: string; total: string };

function barisItem(it: Item): string {
  return `
    <tr>
      <td class="it-nama">${esc(it.nama)}</td>
      <td class="it-mid">${esc(it.hargaUnit)}</td>
      <td class="it-mid">${esc(it.jumlah)}</td>
      <td class="it-total">${esc(it.total)}</td>
    </tr>`;
}

function gaya(): string {
  return `
  ${cssFont()}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin:0; background:${W.latar}; color:${W.teks};
         font-family:'Poppins', sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .halaman { width:210mm; min-height:297mm; padding:16mm 14mm 12mm; display:flex; flex-direction:column;
             position:relative; }

  /* Dua watermark di sisi kanan area tabel. Posisi & ukuran diukur dari gambar
     desain (1191x1684): gabungan keduanya menempati x 158,7-191,8mm, y 116,2-169,1mm. */
  .watermark { position:absolute; left:167.8mm; width:24mm; opacity:.13; z-index:0; }
  .watermark.w1 { top:116.2mm; }
  .watermark.w2 { top:145mm; }
  .halaman > *:not(.watermark) { position:relative; z-index:1; }

  .serif { font-family:'Lora', serif; font-weight:700; }
  .nilai { font-family:'Lora', serif; font-weight:600; }

  .kepala { display:flex; justify-content:space-between; align-items:flex-start; }
  .logo { width:23mm; height:23mm; display:block; margin-bottom:4mm; }
  .logo-placeholder { width:23mm; height:23mm; margin-bottom:4mm; border:1.5px dashed ${W.abu};
      border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center;
      text-align:center; font-size:8pt; font-weight:700; color:${W.abu}; line-height:1.2; }
  .logo-placeholder span { font-size:4.5pt; font-weight:500; }
  .nama-kost { font-size:21pt; line-height:1.15; }
  .label { font-size:11pt; padding-top:5mm; }
  .alamat { font-size:10pt; line-height:1.5; padding-top:1.5mm; }
  .telepon { font-size:10pt; padding-top:4mm; }

  /* Blok kanan rata KIRI, mulai di 62,9% lebar halaman — diukur dari posisi
     "Kepada:" (x=749) dan "INVOICE" (x=750) pada gambar desain selebar 1191px. */
  .kanan { width:37%; flex:none; }
  .judul { font-size:31pt; letter-spacing:.5px; }
  .meta { font-size:10pt; padding-top:5mm; line-height:1.6; }
  .kepada-nama { font-size:11pt; padding-top:1.5mm; }
  .kepada-detail { font-size:9.5pt; padding-top:.8mm; }

  table.item { width:100%; border-collapse:collapse; margin-top:12mm; }
  table.item th { background:${W.abu}; color:${W.teks}; font-weight:500; font-size:10pt; padding:3.6mm 0; }
  table.item th:first-child, table.item td:first-child { text-align:left; padding-left:3mm; }
  table.item th:last-child, table.item td:last-child { text-align:right; padding-right:3mm; }
  table.item th:nth-child(2), table.item th:nth-child(3) { text-align:center; }
  table.item td { border-bottom:1px solid ${W.garis}; padding:4.5mm 0; font-size:10.5pt; }
  .it-mid { text-align:center; }
  .it-nama { font-family:'Poppins', sans-serif; }
  .it-mid, .it-total { font-family:'Lora', serif; font-weight:600; white-space:nowrap; }

  .bawah { display:flex; justify-content:space-between; margin-top:10mm; gap:10mm; }
  .note { width:52%; }
  .note-isi { font-size:9.5pt; line-height:1.65; padding-top:2mm; }
  .rekap { width:44%; }
  .rekap table { width:100%; border-collapse:collapse; }
  .rekap td { font-size:11pt; padding:1.8mm 0; }
  .rekap td.r-label { font-family:'Poppins', sans-serif; }
  .rekap td.r-titik { width:6mm; }
  .rekap td.r-nilai { text-align:right; font-family:'Lora', serif; font-weight:600; white-space:nowrap; }
  .grand { background:${W.abu}; color:${W.teks}; display:flex; justify-content:space-between;
           padding:4mm 4mm; margin-top:4mm; font-size:12pt; }
  .grand .g-label { font-weight:700; }
  .grand .g-nilai { font-family:'Lora', serif; font-weight:600; }

  .penutup { margin-top:auto; padding-top:16mm; }
  .penutup .t1 { font-size:10.5pt; }
  .penutup .t2 { font-family:'Lora', serif; font-style:italic; font-weight:600; font-size:9.5pt; padding-top:1mm; }
  .kontak { border-top:1px solid ${W.garis}; margin-top:5mm; padding-top:4mm; }
  .kontak .k-judul { font-size:12pt; padding-bottom:2mm; }
  .kontak table td { font-size:8.5pt; padding:.5mm 0; }
  .kontak table td:first-child { width:22mm; }
  `;
}

function layout(o: { noInv: string; tanggal: string; kepada: string; items: string; note: string; rekap: string }): string {
  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>${esc(o.noInv)}</title><style>${gaya()}</style></head>
<body>
  <div class="halaman">
    ${blokWatermark()}

    <div class="kepala">
      <div>
        ${blokLogo()}
        <div class="serif nama-kost">Kost Tiga<br>Dara Putri UGM</div>
        <div class="serif label">Alamat</div>
        <div class="alamat">${ALAMAT.map(esc).join('<br>')}</div>
        <div class="telepon">${esc(TELEPON)}</div>
      </div>
      <div class="kanan">
        <div class="serif judul">INVOICE</div>
        <div class="meta nilai">${esc(o.tanggal)}<br>${esc(o.noInv)}</div>
        <div class="serif label">Kepada:</div>
        ${o.kepada}
      </div>
    </div>

    <table class="item">
      <tr><th>Item</th><th>Harga per Unit</th><th>Jumlah</th><th>Total</th></tr>
      ${o.items}
    </table>

    <div class="bawah">
      <div class="note">
        <div class="serif label" style="padding-top:0">Note:</div>
        <div class="note-isi">${o.note}</div>
      </div>
      <div class="rekap">
        <table>${o.rekap}</table>
      </div>
    </div>

    <div class="penutup">
      <div class="serif t1">Terima kasih sudah mempercayai Kost Tiga Dara Putri UGM</div>
      <div class="t2">Tempat pulang setelah hari yang panjang</div>
      <div class="kontak">
        <div class="serif k-judul">Contact Us</div>
        <table>
          <tr><td>Email</td><td class="nilai">: ${EMAIL_KONTAK}</td></tr>
          <tr><td>WhatsApp</td><td class="nilai">: ${esc(TELEPON)}</td></tr>
        </table>
      </div>
    </div>

  </div>
</body>
</html>`;
}

function blokKepada(nama: string, baris: string[]): string {
  return (
    `<div class="nilai kepada-nama">${esc(nama)}</div>` +
    baris.map((b) => `<div class="kepada-detail nilai">${esc(b)}</div>`).join('')
  );
}

function blokRekap(subtotal: number | null, pajak: number | null, diskon: number | null, grandTotal: number | null): string {
  const baris = (label: string, nilai: string) =>
    `<tr><td class="r-label">${esc(label)}</td><td class="r-titik">:</td><td class="r-nilai">${esc(nilai)}</td></tr>`;
  return (
    baris('Subtotal', rp(subtotal)) +
    baris('Pajak', rp(pajak)) +
    baris('Diskon', rp(diskon)) +
    `<tr><td colspan="3"><div class="grand"><span class="g-label">Grand Total&nbsp;&nbsp;:</span><span class="g-nilai">${esc(rp(grandTotal))}</span></div></td></tr>`
  );
}

export function renderInvoiceSewa(inv: InvoiceSewa): string {
  const bulan = Number(inv.jumlah_bulan) || 0;

  // Tiga baris ini SELALU tampil walau nilainya 0, mengikuti bentuk tetap desain.
  const items = [
    barisItem({ nama: 'Sewa Kamar', hargaUnit: rp(inv.harga_sewa), jumlah: String(bulan), total: rp(inv.total_sewa) }),
    barisItem({ nama: 'Biaya Listrik Tambahan', hargaUnit: rp(inv.tambahan_listrik), jumlah: String(bulan), total: rp(inv.total_listrik) }),
    barisItem({ nama: 'Denda', hargaUnit: rp(inv.denda), jumlah: String(Number(inv.jumlah_denda) || 0), total: rp(inv.total_denda) })
  ].join('');

  const note =
    `Pembayaran sewa kamar nomor <span class="nilai">${esc(inv.no_kamar)}</span> untuk periode ` +
    `<span class="nilai">${esc(tanggalId(inv.periode_awal))}</span> s.d. <span class="nilai">${esc(tanggalId(inv.periode_akhir))}</span>`;

  return layout({
    noInv: inv.no_inv,
    tanggal: tanggalId(inv.tanggal_pembayaran),
    kepada: blokKepada(inv.nama, [`Nomor Kamar: ${inv.no_kamar}`]),
    items,
    note,
    rekap: blokRekap(inv.subtotal, inv.pajak, inv.diskon, inv.grand_total)
  });
}

export function renderInvoiceDp(inv: InvoiceDp): string {
  const items = barisItem({
    nama: 'Down Payment',
    hargaUnit: rp(inv.harga_kamar),
    jumlah: String(Number(inv.jumlah) || 1),
    total: rp(inv.subtotal)
  });

  return layout({
    noInv: inv.no_inv,
    tanggal: tanggalId(inv.tanggal_pembayaran),
    kepada: blokKepada(inv.nama, [`Tipe Kamar: ${inv.tipe_kamar || '-'}`, `Nomor: ${inv.no_kamar}`]),
    items,
    note: 'Harap bukti disimpan untuk proses check-in.',
    rekap: blokRekap(inv.subtotal, inv.pajak, inv.diskon, inv.grand_total)
  });
}
