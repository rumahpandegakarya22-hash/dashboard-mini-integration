import type { DataKinerjaSales } from '../builders/sales';
import { esc, rupiah, tgl, waktuWib } from '../format';
import { scorecardHtml } from '../kpi-laporan';
import { kerangkaDokumen } from '../shell';
import { kepalaLaporan } from '../kepala';
import { barKartu, barisDonut, barisGrafik, donutKartu, garisKartu, kartuAngka, segmenDari, WARNA_SERI } from '../grafik';
import { rupiahRingkas } from '../ringkasan';

const kv = (baris: [string, string][]) =>
  `<table>${baris.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;

export function htmlKinerjaSales(d: DataKinerjaSales): string {
  const label = esc(d.periode.label);
  const g = d.grafik;
  const booking = d.booking.map(b =>
    `<tr><td>${tgl(b.tanggal)}</td><td>${esc(b.nama)}</td><td>${esc(b.kamar)}</td><td>${esc(b.status)}</td><td>${rupiah(b.harga)}</td><td>${esc(b.sumber)}</td></tr>`).join('');

  const isi = `
${kepalaLaporan('LAPORAN KINERJA SALES', 'Kost Tiga Dara Putri UGM', `Periode: ${label}   |   Dibuat: ${waktuWib(d.dibuat, true)}`)}
<h3>A. Indikator Kinerja Sales — ${label}</h3>
${scorecardHtml(d.kpi)}
<h3>Ringkasan Visual — ${label}</h3>
${kartuAngka([
  { label: 'Booking Check-in', nilai: String(d.checkIn) }, { label: 'Booking Konfirmasi', nilai: String(d.konfirmasi) }, { label: 'Booking Dibatalkan', nilai: String(d.batal) },
  { label: 'Nilai Booking', nilai: rupiah(d.nilaiBooking) }, { label: 'Total Booking', nilai: String(d.booking.length) },
  { label: 'Pembatalan', nilai: d.booking.length ? `${Math.round((d.batal / d.booking.length) * 100)}%` : '—' },
])}
${barisDonut([
  donutKartu('Status Booking', segmenDari(g.statusBooking), `${d.booking.length} booking`, false),
  donutKartu('Sumber Booking', segmenDari(g.sumber), `${g.sumber.reduce((s, t) => s + t.nilai, 0)} booking`, false),
  donutKartu('Nilai Booking per Sumber', segmenDari(g.nilaiPerSumber), rupiahRingkas(d.nilaiBooking), true),
])}
${barisGrafik([
  barKartu('Funnel Penjualan (Leads → Survey → Booking)', g.funnel),
  barKartu('Nilai Booking per Kamar', g.nilaiPerKamar, { uang: true }),
  garisKartu('Booking per Minggu (tanggal)', [{ nama: 'Booking', warna: WARNA_SERI.utama, titik: g.mingguan }]),
])}
<h3>B. Aktivitas Booking — ${label}</h3>
${kv([
  ['Booking Check-in', String(d.checkIn)], ['Booking Konfirmasi', String(d.konfirmasi)], ['Booking Dibatalkan', String(d.batal)],
  ['Nilai Booking (non-batal)', rupiah(d.nilaiBooking)], ['Sumber Leads Teratas', esc(d.sumberTeratas)],
])}
<table><tr><th>Tgl</th><th>Nama</th><th>Kamar</th><th>Status</th><th>Harga</th><th>Sumber</th></tr>${booking}</table>
${d.booking.length ? '' : '<p>Tidak ada booking pada periode ini.</p>'}
<h3>Rekap per Sumber Leads</h3>
${g.rekapSumber.length
    ? `<table><tr><th>Sumber</th><th>Booking</th><th>Nilai</th></tr>${g.rekapSumber.map(r => `<tr><td>${esc(r.sumber)}</td><td>${r.jumlah}</td><td>${rupiah(r.nilai)}</td></tr>`).join('')}</table>`
    : '<p>Tidak ada booking aktif pada periode ini.</p>'}
<table style="border:none;margin-top:24pt"><tr>
<td style="border:none;width:50%">Dibuat oleh,<br><br><br><br>(________________)<br>Staf Divisi</td>
<td style="border:none;width:50%">Mengetahui,<br><br><br><br>(________________)<br>Pengelola Kost</td>
</tr></table>`;
  return kerangkaDokumen(isi, 'sales');
}
