import type { DataPekerjaan } from '../builders/pekerjaan';
import { esc, tgl, waktuWib } from '../format';
import { kerangkaDokumen } from '../shell';
import { barKartu, barisDonut, barisGrafik, donutKartu, garisKartu, hitungKemunculan, kartuAngka, perMinggu, segmenDari, WARNA_SERI } from '../grafik';
import { ringkasTugas } from '../tugas';

const TITIK = '.'.repeat(85);

export function htmlPekerjaan(d: DataPekerjaan): string {
  const r = ringkasTugas(d.rows);
  const nama = esc(d.divisi);
  const baris = d.rows.length
    ? d.rows.map((x, i) => `<tr><td>${i + 1}</td><td>${tgl(x.tanggal)}</td><td>${esc(x.pekerjaan)}</td><td>${nama}</td><td>${esc(x.pic)}</td><td>${tgl(x.deadline)}</td><td>${esc(x.status)}</td></tr>`).join('')
    : '<tr><td>-</td><td>-</td><td>(tidak ada data pada periode ini)</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>';

  const isi = `
<h1 style="text-align:center">LAPORAN PEKERJAAN BULANAN</h1>
<h2 style="text-align:center">DIVISI ${nama.toUpperCase()} — KOST TIGA DARA</h2>
<p>Periode: ${esc(d.periode.label)}</p>
<p>Tanggal dibuat: ${waktuWib(d.dibuat, false)}</p>
<h3>A. RINGKASAN</h3>
<table><tr><th>Indikator</th><th>Jumlah</th></tr>
<tr><td>Total Pekerjaan</td><td>${r.total}</td></tr>
<tr><td>Selesai</td><td>${r.selesai}</td></tr>
<tr><td>Proses</td><td>${r.proses}</td></tr>
<tr><td>Tertunda</td><td>${r.tertunda}</td></tr>
<tr><td>Persentase Selesai</td><td>${r.persen}%</td></tr></table>
<h3>Ringkasan Visual — ${esc(d.periode.label)}</h3>
${kartuAngka([
  { label: 'Total Pekerjaan', nilai: String(r.total) }, { label: 'Selesai', nilai: String(r.selesai) }, { label: 'Proses', nilai: String(r.proses) },
  { label: 'Tertunda', nilai: String(r.tertunda) }, { label: 'Persentase Selesai', nilai: `${r.persen}%` },
], 4)}
${barisDonut([
  donutKartu('Status Pekerjaan', segmenDari([
    { label: 'Selesai', nilai: r.selesai }, { label: 'Proses', nilai: r.proses }, { label: 'Tertunda', nilai: r.tertunda },
  ].filter(s => s.nilai > 0)), `${r.total} pekerjaan`, false),
  donutKartu('Pekerjaan per PIC', segmenDari(hitungKemunculan(d.rows.map(x => (x.pic === '-' ? null : x.pic)))), `${r.total} pekerjaan`, false),
])}
${barisGrafik([
  barKartu('Jumlah Pekerjaan per PIC', hitungKemunculan(d.rows.map(x => (x.pic === '-' ? null : x.pic)))),
  garisKartu('Pekerjaan per Minggu (tanggal)', [
    { nama: 'Dikerjakan', warna: WARNA_SERI.utama, titik: perMinggu(d.rows.map(x => ({ tanggal: x.tanggal })), d.periode) },
    { nama: 'Selesai', warna: WARNA_SERI.kedua, titik: perMinggu(d.rows.filter(x => x.status === 'Selesai').map(x => ({ tanggal: x.tanggal })), d.periode) },
  ]),
])}
<h3>B. RINCIAN PEKERJAAN</h3>
<table><tr><th>No</th><th>Tanggal</th><th>Pekerjaan</th><th>Bidang</th><th>PIC</th><th>Deadline</th><th>Status</th></tr>${baris}</table>
<h3>C. CATATAN / KENDALA</h3>
<p>${TITIK}</p>
<p>${TITIK}</p>
<table style="border:none;margin-top:24pt"><tr>
<td style="border:none;width:50%">Dibuat oleh,<br><br><br><br>(________________)<br>Staf ${nama.toUpperCase()}</td>
<td style="border:none;width:50%">Disetujui oleh,<br><br><br><br>(________________)<br>Pengelola</td>
</tr></table>`;
  return kerangkaDokumen(isi, d.divisi === 'Marketing' ? 'marketing' : d.divisi === 'Sales' ? 'sales' : 'admin');
}
