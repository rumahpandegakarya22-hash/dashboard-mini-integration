import type { DataKinerjaMarketing } from '../builders/marketing';
import { esc, rupiah, tgl, waktuWib } from '../format';
import { scorecardHtml } from '../kpi-laporan';
import { kerangkaDokumen } from '../shell';
import { kepalaLaporan } from '../kepala';
import { barKartu, barisDonut, barisGrafik, donutKartu, garisKartu, kartuAngka, segmenDari, WARNA_SERI } from '../grafik';
import { rupiahRingkas } from '../ringkasan';

const kv = (baris: [string, string][]) =>
  `<table>${baris.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
const angka = (n: number) => n.toLocaleString('id-ID');

export function htmlKinerjaMarketing(d: DataKinerjaMarketing): string {
  const label = esc(d.periode.label);
  const { leads, konten: k, kampanye: c, grafik: g, rincian: r } = d;

  const isi = `
${kepalaLaporan('LAPORAN KINERJA MARKETING', 'Kost Tiga Dara Putri UGM', `Periode: ${label}   |   Dibuat: ${waktuWib(d.dibuat, true)}`)}
<h3>A. Indikator Kinerja Marketing — ${label}</h3>
${scorecardHtml(d.kpi)}
<h3>Ringkasan Visual — ${label}</h3>
${kartuAngka([
  { label: 'Leads Masuk', nilai: angka(leads.total) }, { label: 'Post Konten', nilai: angka(k.post) }, { label: 'Total Reach', nilai: angka(k.reach) },
  { label: 'Kampanye', nilai: angka(c.jumlah) }, { label: 'Spend Aktual', nilai: rupiahRingkas(c.spend) }, { label: 'Booking dari Promo', nilai: angka(c.bookingDariPromo) },
])}
${barisDonut([
  donutKartu('Sumber Leads', segmenDari(g.sumberLeads), `${leads.total} leads`, false),
  donutKartu('Status Leads', segmenDari(g.statusLeads), `${leads.total} leads`, false),
  donutKartu('Konten per Platform', segmenDari(g.platformKonten), `${k.post} post`, false),
])}
${barisGrafik([
  barKartu('Engagement per Platform (like + komentar + share)', g.engagementPlatform),
  barKartu('Spend Aktual per Kampanye', g.spendKampanye, { uang: true }),
  garisKartu('Leads dan Konten per Minggu (tanggal)', [
    { nama: 'Leads masuk', warna: WARNA_SERI.utama, titik: g.mingguan.leads },
    { nama: 'Post konten', warna: WARNA_SERI.kedua, titik: g.mingguan.konten },
  ]),
])}
<h3>B. Akuisisi Leads — ${label}</h3>
${kv([['Total Leads Masuk', angka(leads.total)], ['Sumber Teratas', esc(leads.sumberTeratas)], ['Status Leads', esc(leads.statusRingkas)]])}
${leads.total ? '' : '<p>Tidak ada leads pada periode ini.</p>'}
<h3>C. Kinerja Konten Sosial Media</h3>
${kv([
  ['Jumlah Post', angka(k.post)], ['Total Reach', angka(k.reach)], ['Total Likes', angka(k.likes)],
  ['Total Komentar', angka(k.komentar)], ['Total Share/Saves', angka(k.shareSaves)],
  ['Platform Teraktif', esc(k.platformTeraktif)],
])}
${k.post ? '' : '<p>Tidak ada konten pada periode ini.</p>'}
<h3>D. Kinerja Kampanye / Promosi</h3>
${kv([
  ['Jumlah Kampanye', angka(c.jumlah)], ['Total Budget', rupiah(c.budget)], ['Total Spend Aktual', rupiah(c.spend)],
  ['Target Leads', angka(c.targetLeads)], ['Leads Aktual', angka(c.leadsAktual)],
  ['Booking dari Promo', angka(c.bookingDariPromo)],
])}
${c.jumlah ? '' : '<p>Tidak ada kampanye pada periode ini.</p>'}
<h2>LAMPIRAN — Detail Data (${label})</h2>
<h3>Rincian Leads</h3>
${r.leads.length
    ? `<table><tr><th>Tanggal</th><th>Sumber</th><th>Platform</th><th>Status</th></tr>${r.leads.map(x => `<tr><td>${tgl(x.tanggal)}</td><td>${esc(x.sumber)}</td><td>${esc(x.platform)}</td><td>${esc(x.status)}</td></tr>`).join('')}</table>`
    : '<p>Tidak ada leads pada periode ini.</p>'}
<h3>Rincian Konten</h3>
${r.konten.length
    ? `<table class="padat"><tr><th>Tanggal</th><th>Platform</th><th>Tipe</th><th>Judul</th><th>Reach</th><th>Likes</th><th>Komentar</th><th>Share/Saves</th></tr>${r.konten.map(x => `<tr><td>${tgl(x.tanggal)}</td><td>${esc(x.platform)}</td><td>${esc(x.tipe)}</td><td>${esc(x.judul)}</td><td>${angka(x.reach)}</td><td>${angka(x.likes)}</td><td>${angka(x.komentar)}</td><td>${angka(x.shareSaves)}</td></tr>`).join('')}</table>`
    : '<p>Tidak ada konten pada periode ini.</p>'}
<h3>Rincian Kampanye / Promosi</h3>
${r.kampanye.length
    ? `<table class="padat"><tr><th>Kampanye</th><th>Platform</th><th>Periode</th><th>Budget</th><th>Spend</th><th>Target Leads</th><th>Leads Aktual</th><th>Booking</th></tr>${r.kampanye.map(x => `<tr><td>${esc(x.nama)}</td><td>${esc(x.platform)}</td><td>${tgl(x.mulai)} – ${tgl(x.selesai)}</td><td>${rupiah(x.budget)}</td><td>${rupiah(x.spend)}</td><td>${angka(x.targetLeads)}</td><td>${angka(x.leadsAktual)}</td><td>${angka(x.booking)}</td></tr>`).join('')}</table>`
    : '<p>Tidak ada kampanye pada periode ini.</p>'}
<table style="border:none;margin-top:24pt"><tr>
<td style="border:none;width:50%">Dibuat oleh,<br><br><br><br>(________________)<br>Staf Divisi</td>
<td style="border:none;width:50%">Mengetahui,<br><br><br><br>(________________)<br>Pengelola Kost</td>
</tr></table>`;
  return kerangkaDokumen(isi, 'marketing');
}
