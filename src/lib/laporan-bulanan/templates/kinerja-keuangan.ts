import type { DataKinerjaKeuangan } from '../builders/keuangan';
import { esc, rupiah, tglPendek, waktuWib } from '../format';
import { kerangkaDokumen } from '../shell';

const kv = (baris: [string, string][]) =>
  `<table>${baris.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;

export function htmlKinerjaKeuangan(d: DataKinerjaKeuangan): string {
  const label = esc(d.periode.label);
  const kategori = d.perKategori.length
    ? d.perKategori.map(k => `<tr><td>${esc(k.kategori)}</td><td>${rupiah(k.total)}</td></tr>`).join('')
    : '<tr><td>-</td><td>Rp0</td></tr>';
  const transaksi = d.transaksi.map(t =>
    `<tr><td>${tglPendek(t.tanggal)}</td><td>${esc(t.debit)}</td><td>${esc(t.kredit)}</td><td>${rupiah(t.nominal)}</td><td>${esc(t.keterangan)}</td></tr>`).join('');

  const isi = `
<h1 style="text-align:center">LAPORAN KINERJA KEUANGAN</h1>
<h2 style="text-align:center">Kost Tiga Dara Putri UGM</h2>
<p>Periode: ${label}   |   Dibuat: ${waktuWib(d.dibuat, true)}</p>
<p>Catatan: ini rekap kinerja kas &amp; laba bulanan. Laporan akuntansi formal (Laba Rugi, Neraca, Arus Kas) tetap dihasilkan melalui modul Laporan Keuangan.</p>
<h3>A. Kinerja Arus Kas — ${label}</h3>
${kv([['Kas Masuk', rupiah(d.kasMasuk)], ['Kas Keluar', rupiah(d.kasKeluar)], ['Arus Kas Bersih', rupiah(d.arusBersih)], ['Jumlah Transaksi', String(d.jumlahTransaksi)]])}
<h3>B. Kinerja Laba/Rugi (berbasis pengakuan)</h3>
${kv([['Pendapatan', rupiah(d.pendapatan)], ['Beban', rupiah(d.beban)], ['Laba / (Rugi) Bulan Ini', rupiah(d.laba)]])}
<h3>C. Pengeluaran per Kategori</h3>
<table><tr><th>Kategori</th><th>Total Pengeluaran</th></tr>${kategori}</table>
<h3>D. Rincian Transaksi</h3>
<table><tr><th>Tgl</th><th>Debit</th><th>Kredit</th><th>Nominal</th><th>Keterangan</th></tr>${transaksi}</table>
${d.transaksi.length ? '' : '<p>Tidak ada transaksi pada periode ini.</p>'}
<table style="border:none;margin-top:24pt"><tr>
<td style="border:none;width:50%">Dibuat oleh,<br><br><br><br>(________________)<br>Staf Divisi</td>
<td style="border:none;width:50%">Mengetahui,<br><br><br><br>(________________)<br>Pengelola Kost</td>
</tr></table>`;
  return kerangkaDokumen(isi, 'dokumen');
}
