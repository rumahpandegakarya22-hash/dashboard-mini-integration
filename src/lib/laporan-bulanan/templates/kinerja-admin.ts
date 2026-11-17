import type { DataKinerjaAdmin } from '../builders/admin';
import { esc, waktuWib } from '../format';
import { scorecardHtml } from '../kpi-laporan';
import { kerangkaDokumen } from '../shell';
import { kepalaLaporan } from '../kepala';
import { barKartu, barVertikalKartu, barisDonut, barisGrafik, donutKartu, garisKartu, kartuAngka, segmenDari, WARNA_SERI } from '../grafik';

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
  const { feedback: f, pelanggaran: p, kecelakaan: k, lampiran: l, grafik: g } = d;

  const isi = `
${kepalaLaporan('LAPORAN KINERJA ADMIN', 'Kost Tiga Dara Putri UGM', `Periode: ${label}   |   Dibuat: ${waktuWib(d.dibuat, true)}`)}
<h3>A. Indikator Kinerja Admin — ${label}</h3>
${scorecardHtml(d.kpi)}
<h3>Ringkasan Visual — ${label}</h3>
${kartuAngka([
  { label: 'Feedback Masuk', nilai: angka(f.total) }, { label: 'Selesai Ditangani', nilai: angka(f.selesai) }, { label: 'Masih Proses', nilai: angka(f.proses) },
  { label: 'Pelanggaran', nilai: angka(p.total) }, { label: 'Kecelakaan Kerja', nilai: angka(k.total) },
  { label: 'Tingkat Selesai', nilai: f.total ? `${Math.round((f.selesai / f.total) * 100)}%` : '—' },
])}
${barisDonut([
  donutKartu('Status Feedback', segmenDari(g.statusFeedback), `${f.total} feedback`, false),
  donutKartu('Kategori Feedback', segmenDari(g.kategoriFeedback), `${f.total} feedback`, false),
  donutKartu('Jenis Pelanggaran', segmenDari(g.jenisPelanggaran), `${p.total} kasus`, false),
])}
${barisGrafik([
  barVertikalKartu('Penanganan Feedback', [{ label: 'Masuk', nilai: f.total }, { label: 'Selesai', nilai: f.selesai }, { label: 'Proses', nilai: f.proses }]),
  barKartu('Lokasi Kecelakaan Kerja', g.lokasiKecelakaan),
  garisKartu('Aktivitas Logbook per Minggu (tanggal)', [
    { nama: 'Feedback', warna: WARNA_SERI.utama, titik: g.mingguan.feedback },
    { nama: 'Pelanggaran', warna: WARNA_SERI.kedua, titik: g.mingguan.pelanggaran },
    { nama: 'Kecelakaan', warna: WARNA_SERI.ketiga, titik: g.mingguan.kecelakaan },
  ]),
])}
<h3>B. Penanganan Feedback Penghuni — ${label}</h3>
${kv([
  ['Total Feedback Masuk', angka(f.total)], ['Selesai Ditangani', angka(f.selesai)], ['Masih Proses', angka(f.proses)],
  ['Kategori', esc(f.kategori)],
])}
${f.total ? '' : '<p>Tidak ada feedback pada periode ini.</p>'}
<h3>C. Pelanggaran Peraturan</h3>
${kv([['Total Pelanggaran', angka(p.total)], ['Jenis', esc(p.jenis)]])}
${p.total ? '' : '<p>Tidak ada pelanggaran pada periode ini.</p>'}
<h3>D. Logbook Kecelakaan Kerja</h3>
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
  return kerangkaDokumen(isi, 'admin');
}
