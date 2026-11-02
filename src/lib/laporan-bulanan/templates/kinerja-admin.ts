import type { DataKinerjaAdmin } from '../builders/admin';
import { esc, rupiah, waktuWib } from '../format';
import { kerangkaDokumen } from '../shell';

const kv = (baris: [string, string][]) =>
  `<table>${baris.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
const angka = (n: number) => n.toLocaleString('id-ID');

function lampiran(judul: string, kepala: string[], rows: string[][]): string {
  const isi = rows.length
    ? `<table><tr>${kepala.map(k => `<th>${k}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`
    : '<p>Tidak ada entri pada periode ini.</p>';
  return `<h3>${judul}</h3>\n${isi}`;
}

export function htmlKinerjaAdmin(d: DataKinerjaAdmin): string {
  const label = esc(d.periode.label);
  const { feedback: f, pelanggaran: p, kecelakaan: k, lampiran: l } = d;

  const isi = `
<h1 style="text-align:center">LAPORAN KINERJA ADMIN</h1>
<h2 style="text-align:center">Kost Tiga Dara Putri UGM</h2>
<p>Periode: ${label}   |   Dibuat: ${waktuWib(d.dibuat, true)}</p>
<h3>A. Penanganan Feedback Penghuni — ${label}</h3>
${kv([
  ['Total Feedback Masuk', angka(f.total)], ['Selesai Ditangani', angka(f.selesai)], ['Masih Proses', angka(f.proses)],
  ['Total Biaya Penanganan', rupiah(f.biaya)], ['Kategori', esc(f.kategori)],
])}
${f.total ? '' : '<p>Tidak ada feedback pada periode ini.</p>'}
<h3>B. Pelanggaran Peraturan</h3>
${kv([['Total Pelanggaran', angka(p.total)], ['Jenis', esc(p.jenis)]])}
${p.total ? '' : '<p>Tidak ada pelanggaran pada periode ini.</p>'}
<h3>C. Logbook Kecelakaan Kerja</h3>
${kv([['Total Kecelakaan Kerja', angka(k.total)], ['Lokasi', esc(k.lokasi)]])}
${k.total ? '' : '<p>Tidak ada kecelakaan kerja pada periode ini.</p>'}
<h2>LAMPIRAN — Detail Logbook (${label})</h2>
${lampiran('Lampiran 1. Logbook Feedback', ['Tanggal', 'No. Kamar', 'Kategori', 'Deskripsi', 'Status'], l.feedback)}
${lampiran('Lampiran 2. Logbook Pelanggaran Peraturan', ['Tanggal', 'Jenis', 'Deskripsi', 'Penghuni/Petugas', 'Tindakan'], l.pelanggaran)}
${lampiran('Lampiran 3. Logbook Kecelakaan Kerja', ['Tanggal', 'Lokasi', 'Petugas', 'Kronologi', 'Tindakan'], l.kecelakaan)}
<table style="border:none;margin-top:24pt"><tr>
<td style="border:none;width:50%">Dibuat oleh,<br><br><br><br>(________________)<br>Staf Divisi</td>
<td style="border:none;width:50%">Mengetahui,<br><br><br><br>(________________)<br>Pengelola Kost</td>
</tr></table>`;
  return kerangkaDokumen(isi, 'kinerja');
}
