import type { DataKinerjaOperasional } from '../builders/operasional';
import { esc, rupiah, tglPendek, waktuWib } from '../format';
import { kerangkaDokumen } from '../shell';

const kv = (baris: [string, string][]) =>
  `<table>${baris.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
const angka = (n: number) => n.toLocaleString('id-ID');
const tabel = (kepala: string[], rows: string[][]) =>
  `<table><tr>${kepala.map(k => `<th>${k}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

export function htmlKinerjaOperasional(d: DataKinerjaOperasional): string {
  const label = esc(d.periode.label);
  const { inspeksi: i, preventif: p, korektif: k } = d;

  const barisP = p.rows.map(r => [tglPendek(r.tgl), esc(r.fasilitas), esc(r.jenis), esc(r.prioritas), rupiah(r.biaya), esc(r.status)]);
  const barisK = k.rows.map(r => [tglPendek(r.tgl), esc(r.lokasi), esc(r.kerusakan), esc(r.prioritas), rupiah(r.biaya), esc(r.status)]);

  const isi = `
<h1 style="text-align:center">LAPORAN KINERJA OPERASIONAL (INSPEKSI &amp; MAINTENANCE)</h1>
<h2 style="text-align:center">Kost Tiga Dara Putri UGM</h2>
<p>Periode: ${label}   |   Dibuat: ${waktuWib(d.dibuat, true)}</p>
<h3>A. Inspeksi Harian — ${label}</h3>
${kv([['Total Inspeksi Dilakukan', angka(i.total)], ['Temuan Perlu Tindak Lanjut', angka(i.perluTindakLanjut)]])}
${i.total ? '' : '<p>Tidak ada inspeksi pada periode ini.</p>'}
<h3>B. Perawatan (Preventif)</h3>
${kv([
  ['Total Kegiatan Perawatan', angka(p.total)], ['Selesai', angka(p.selesai)], ['Proses/Tertunda', angka(p.belum)],
  ['Total Biaya Perawatan', rupiah(p.biaya)],
])}
${p.total ? tabel(['Tgl', 'Fasilitas', 'Jenis', 'Prioritas', 'Biaya', 'Status'], barisP) : '<p>Tidak ada perawatan pada periode ini.</p>'}
<h3>C. Perbaikan (Korektif)</h3>
${kv([
  ['Total Laporan Kerusakan', angka(k.total)], ['Perbaikan Selesai', angka(k.selesai)], ['Proses/Tertunda', angka(k.belum)],
  ['Prioritas Darurat', angka(k.darurat)], ['Rata-rata Durasi Perbaikan (hari)', angka(k.rataDurasiHari)],
  ['Total Biaya Perbaikan', rupiah(k.biaya)],
])}
${k.total ? tabel(['Tgl', 'Lokasi/Item', 'Kerusakan', 'Prioritas', 'Biaya', 'Status'], barisK) : '<p>Tidak ada perbaikan pada periode ini.</p>'}
<h3>D. Total Pengeluaran Operasional</h3>
${kv([['Biaya Perawatan + Perbaikan', rupiah(d.totalBiaya)]])}
<table style="border:none;margin-top:24pt"><tr>
<td style="border:none;width:50%">Dibuat oleh,<br><br><br><br>(________________)<br>Staf Divisi</td>
<td style="border:none;width:50%">Mengetahui,<br><br><br><br>(________________)<br>Pengelola Kost</td>
</tr></table>`;
  return kerangkaDokumen(isi, 'dokumen');
}
