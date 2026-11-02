import type { DataKinerjaSales } from '../builders/sales';
import { esc, rupiah, tgl, waktuWib } from '../format';
import { kerangkaDokumen } from '../shell';

const kv = (baris: [string, string][]) =>
  `<table>${baris.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;

export function htmlKinerjaSales(d: DataKinerjaSales): string {
  const label = esc(d.periode.label);
  const s = d.survey;
  const booking = d.booking.map(b =>
    `<tr><td>${tgl(b.tanggal)}</td><td>${esc(b.nama)}</td><td>${esc(b.kamar)}</td><td>${esc(b.status)}</td><td>${rupiah(b.harga)}</td><td>${esc(b.sumber)}</td></tr>`).join('');

  const isi = `
<h1 style="text-align:center">LAPORAN KINERJA SALES</h1>
<h2 style="text-align:center">Kost Tiga Dara Putri UGM</h2>
<p>Periode: ${label}   |   Dibuat: ${waktuWib(d.dibuat, true)}</p>
<h3>A. Aktivitas Booking — ${label}</h3>
${kv([
  ['Booking Check-in', String(d.checkIn)], ['Booking Konfirmasi', String(d.konfirmasi)], ['Booking Dibatalkan', String(d.batal)],
  ['Nilai Booking (non-batal)', rupiah(d.nilaiBooking)], ['Sumber Leads Teratas', esc(d.sumberTeratas)],
])}
<table><tr><th>Tgl</th><th>Nama</th><th>Kamar</th><th>Status</th><th>Harga</th><th>Sumber</th></tr>${booking}</table>
${d.booking.length ? '' : '<p>Tidak ada booking pada periode ini.</p>'}
<h3>B. Aktivitas Survey / Leads — ${label}</h3>
${kv([['Total Survey', String(s.total)], ['Tertarik / Lanjut', String(s.tertarik)], ['Konversi Minat', `${s.konversiPersen}%`]])}
${s.total ? '' : '<p>Tidak ada survey pada periode ini.</p>'}
<table style="border:none;margin-top:24pt"><tr>
<td style="border:none;width:50%">Dibuat oleh,<br><br><br><br>(________________)<br>Staf Divisi</td>
<td style="border:none;width:50%">Mengetahui,<br><br><br><br>(________________)<br>Pengelola Kost</td>
</tr></table>`;
  return kerangkaDokumen(isi, 'kinerja');
}
