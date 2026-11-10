import type { DataKerjaOperasional } from '../builders/operasional';
import { esc, isoWib, tgl, waktuWib } from '../format';
import { kerangkaDokumen } from '../shell';
import { lewatDeadline } from '../tugas';

const kv = (baris: [string, string | number][]) =>
  `<table>${baris.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;

const HURUF = ['A', 'B', 'C'];

export function htmlKerjaOperasional(d: DataKerjaOperasional): string {
  const hariIni = isoWib(d.dibuat);
  const hitung = d.sub.map(s => ({
    nama: s.nama,
    tugas: s.tugas,
    total: s.tugas.length,
    complete: s.tugas.filter(t => t.status === 'Complete').length,
    proses: s.tugas.filter(t => t.status === 'In Progress').length,
    pending: s.tugas.filter(t => t.status === 'Pending').length,
    lewat: s.tugas.filter(t => lewatDeadline(t, hariIni)).length,
  }));
  const jml = (f: (h: (typeof hitung)[number]) => number) => hitung.reduce((a, h) => a + f(h), 0);
  const total = jml(h => h.total);
  const complete = jml(h => h.complete);
  const persen = total === 0 ? 0 : Math.round((complete / total) * 100);

  const baris = (cells: (string | number)[]) => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
  const ringkasan = [
    ...hitung.map(h => baris([h.nama, h.total, h.complete, h.proses, h.pending, h.lewat])),
    baris(['TOTAL', total, complete, jml(h => h.proses), jml(h => h.pending), jml(h => h.lewat)]),
  ].join('');

  const bagian = hitung.map((h, i) => {
    const rows = h.tugas.map(t => baris([
      tgl(t.tanggal), esc(t.task), esc(t.pic), tgl(t.deadline), esc(t.status),
    ])).join('');
    return `<h3>${HURUF[i]}. Divisi ${h.nama}</h3>
${kv([['Total Task', h.total], ['Complete', h.complete], ['In Progress', h.proses], ['Pending', h.pending], ['Lewat Deadline (belum complete)', h.lewat]])}
${h.total
    ? `<table><tr><th>Tanggal</th><th>Task</th><th>PIC</th><th>Deadline</th><th>Status</th></tr>${rows}</table>`
    : '<p>Tidak ada task tercatat pada periode ini.</p>'}`;
  }).join('\n');

  const isi = `
<h1 style="text-align:center">LAPORAN KERJA DIVISI OPERASIONAL</h1>
<h2 style="text-align:center">Kost Tiga Dara Putri UGM</h2>
<p>Lingkup: Maintenance, Inspeksi, Kebersihan   |   Periode: ${esc(d.periode.label)}   |   Dibuat: ${waktuWib(d.dibuat, true)}</p>
<h3>Ringkasan Eksekutif</h3>
<table><tr><th>Divisi</th><th>Total Task</th><th>Complete</th><th>In Progress</th><th>Pending</th><th>Lewat Deadline</th></tr>${ringkasan}</table>
<p>Tingkat penyelesaian gabungan: ${persen}% (${complete} dari ${total} task).</p>
${bagian}
<table style="border:none;margin-top:24pt"><tr>
<td style="border:none;width:50%">Dibuat oleh,<br><br><br><br>(________________)<br>Staf Divisi Operasional</td>
<td style="border:none;width:50%">Mengetahui,<br><br><br><br>(________________)<br>Pengelola Kost</td>
</tr></table>`;
  return kerangkaDokumen(isi, 'kinerja');
}
