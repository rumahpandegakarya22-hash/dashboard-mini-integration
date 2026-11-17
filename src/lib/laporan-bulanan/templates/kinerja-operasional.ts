import type { DataKinerjaOperasional } from '../builders/operasional';
import { esc, rupiah, tgl, waktuWib } from '../format';
import { scorecardHtml } from '../kpi-laporan';
import { kerangkaDokumen } from '../shell';
import { kepalaLaporan } from '../kepala';
import { barKartu, barisDonut, barisGrafik, donutKartu, garisKartu, kartuAngka, segmenDari, WARNA_SERI } from '../grafik';
import { rupiahRingkas } from '../ringkasan';

const kv = (baris: [string, string][]) =>
  `<table>${baris.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
const angka = (n: number) => n.toLocaleString('id-ID');
const tabel = (kepala: string[], rows: string[][]) =>
  `<table><tr>${kepala.map(k => `<th>${k}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

export function htmlKinerjaOperasional(d: DataKinerjaOperasional): string {
  const label = esc(d.periode.label);
  const { inspeksi: i, preventif: p, korektif: k, grafik: g } = d;

  const barisP = p.rows.map(r => [tgl(r.tgl), esc(r.fasilitas), esc(r.jenis), esc(r.prioritas), rupiah(r.biaya), esc(r.status)]);
  const barisK = k.rows.map(r => [tgl(r.tgl), esc(r.lokasi), esc(r.kerusakan), esc(r.prioritas), rupiah(r.biaya), esc(r.status)]);

  const isi = `
${kepalaLaporan('LAPORAN KINERJA OPERASIONAL (INSPEKSI &amp; MAINTENANCE)', 'Kost Tiga Dara Putri UGM', `Periode: ${label}   |   Dibuat: ${waktuWib(d.dibuat, true)}`)}
<h3>A. Indikator Kinerja Operasional — ${label}</h3>
${scorecardHtml(d.kpi)}
<h3>Ringkasan Visual — ${label}</h3>
${kartuAngka([
  { label: 'Inspeksi', nilai: angka(i.total) }, { label: 'Perawatan', nilai: angka(p.total) }, { label: 'Perbaikan', nilai: angka(k.total) },
  { label: 'Pekerjaan Selesai', nilai: angka(p.selesai + k.selesai) }, { label: 'Prioritas Darurat', nilai: angka(k.darurat) }, { label: 'Total Biaya', nilai: rupiahRingkas(d.totalBiaya) },
])}
${barisDonut([
  donutKartu('Status Pekerjaan', segmenDari(g.statusPekerjaan), `${p.total + k.total} pekerjaan`, false),
  donutKartu('Prioritas Perbaikan', segmenDari(g.prioritasKorektif), `${k.total} laporan`, false),
  donutKartu('Komposisi Biaya', segmenDari(g.komposisiBiaya), rupiahRingkas(d.totalBiaya), true),
])}
${barisGrafik([
  barKartu('Biaya per Lokasi / Fasilitas', g.biayaPerLokasi, { uang: true }),
  barKartu('Inspeksi per Kategori', g.inspeksiKategori),
  garisKartu('Aktivitas Operasional per Minggu (tanggal)', [
    { nama: 'Inspeksi', warna: WARNA_SERI.ketiga, titik: g.mingguan.inspeksi },
    { nama: 'Perawatan', warna: WARNA_SERI.kedua, titik: g.mingguan.preventif },
    { nama: 'Perbaikan', warna: WARNA_SERI.utama, titik: g.mingguan.korektif },
  ]),
])}
<h3>B. Inspeksi Harian — ${label}</h3>
${kv([['Total Inspeksi Dilakukan', angka(i.total)], ['Temuan Perlu Tindak Lanjut', angka(i.perluTindakLanjut)]])}
${i.total
    ? tabel(['Tgl', 'Area', 'Kondisi Ditemukan', 'Kategori', 'Tindak Lanjut', 'Petugas'], i.rows.map(r => [tgl(r.tanggal), esc(r.area), esc(r.kondisi), esc(r.kategori), esc(r.tindakLanjut), esc(r.petugas)]))
    : '<p>Tidak ada inspeksi pada periode ini.</p>'}
<h3>C. Perawatan (Preventif)</h3>
${kv([
  ['Total Kegiatan Perawatan', angka(p.total)], ['Selesai', angka(p.selesai)], ['Proses/Tertunda', angka(p.belum)],
  ['Total Biaya Perawatan', rupiah(p.biaya)],
])}
${p.total ? tabel(['Tgl', 'Fasilitas', 'Jenis', 'Prioritas', 'Biaya', 'Status'], barisP) : '<p>Tidak ada perawatan pada periode ini.</p>'}
<h3>D. Perbaikan (Korektif)</h3>
${kv([
  ['Total Laporan Kerusakan', angka(k.total)], ['Perbaikan Selesai', angka(k.selesai)], ['Proses/Tertunda', angka(k.belum)],
  ['Prioritas Darurat', angka(k.darurat)],
  ['Total Biaya Perbaikan', rupiah(k.biaya)],
])}
${k.total ? tabel(['Tgl', 'Lokasi/Item', 'Kerusakan', 'Prioritas', 'Biaya', 'Status'], barisK) : '<p>Tidak ada perbaikan pada periode ini.</p>'}
<h3>E. Total Pengeluaran Operasional</h3>
${kv([['Biaya Perawatan + Perbaikan', rupiah(d.totalBiaya)]])}
<table style="border:none;margin-top:24pt"><tr>
<td style="border:none;width:50%">Dibuat oleh,<br><br><br><br>(________________)<br>Staf Divisi</td>
<td style="border:none;width:50%">Mengetahui,<br><br><br><br>(________________)<br>Pengelola Kost</td>
</tr></table>`;
  return kerangkaDokumen(isi, 'operasional');
}
