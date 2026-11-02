import type { DataKinerjaMarketing } from '../builders/marketing';
import { esc, rupiah, waktuWib } from '../format';
import { kerangkaDokumen } from '../shell';

const kv = (baris: [string, string][]) =>
  `<table>${baris.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
const angka = (n: number) => n.toLocaleString('id-ID');

export function htmlKinerjaMarketing(d: DataKinerjaMarketing): string {
  const label = esc(d.periode.label);
  const { leads, konten: k, kampanye: c } = d;

  const isi = `
<h1 style="text-align:center">LAPORAN KINERJA MARKETING</h1>
<h2 style="text-align:center">Kost Tiga Dara Putri UGM</h2>
<p>Periode: ${label}   |   Dibuat: ${waktuWib(d.dibuat, true)}</p>
<h3>A. Akuisisi Leads — ${label}</h3>
${kv([['Total Leads Masuk', angka(leads.total)], ['Sumber Teratas', esc(leads.sumberTeratas)], ['Status Leads', esc(leads.statusRingkas)]])}
${leads.total ? '' : '<p>Tidak ada leads pada periode ini.</p>'}
<h3>B. Kinerja Konten Sosial Media</h3>
${kv([
  ['Jumlah Post', angka(k.post)], ['Total Reach', angka(k.reach)], ['Total Likes', angka(k.likes)],
  ['Total Komentar', angka(k.komentar)], ['Total Share/Saves', angka(k.shareSaves)],
  ['Engagement Rate', `${String(k.engagementPersen).replace('.', ',')}%`], ['Platform Teraktif', esc(k.platformTeraktif)],
])}
${k.post ? '' : '<p>Tidak ada konten pada periode ini.</p>'}
<h3>C. Kinerja Kampanye / Promosi</h3>
${kv([
  ['Jumlah Kampanye', angka(c.jumlah)], ['Total Budget', rupiah(c.budget)], ['Total Spend Aktual', rupiah(c.spend)],
  ['Target Leads', angka(c.targetLeads)], ['Leads Aktual', angka(c.leadsAktual)],
  ['Capaian Target', `${c.capaianPersen}%`], ['Booking dari Promo', angka(c.bookingDariPromo)],
])}
${c.jumlah ? '' : '<p>Tidak ada kampanye pada periode ini.</p>'}
<table style="border:none;margin-top:24pt"><tr>
<td style="border:none;width:50%">Dibuat oleh,<br><br><br><br>(________________)<br>Staf Divisi</td>
<td style="border:none;width:50%">Mengetahui,<br><br><br><br>(________________)<br>Pengelola Kost</td>
</tr></table>`;
  return kerangkaDokumen(isi, 'dokumen');
}
