import type { DataKinerjaKeuangan } from '../builders/keuangan';
import { esc, rupiah, teksTgl, tgl, waktuWib } from '../format';
import { scorecardHtml } from '../kpi-laporan';
import { kerangkaDokumen } from '../shell';
import { kepalaLaporan } from '../kepala';
import { barVertikalKartu, barisDonut, barisGrafik, donutKartu, garisKartu, kartuAngka, WARNA_SERI } from '../grafik';
import { gabungSegmen, rupiahRingkas } from '../ringkasan';

const kv = (baris: [string, string][]) =>
  `<table>${baris.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;

function rincianAkun(
  income: { label: string; nilai: number }[],
  opex: { label: string; nilai: number }[],
  nonOp: { label: string; nilai: number }[] = []
): string {
  const baris = (judul: string, xs: { label: string; nilai: number }[]) =>
    xs.length
      ? `<tr><th colspan="2">${judul}</th></tr>${xs.map(x => `<tr><td>${esc(x.label)}</td><td>${rupiah(x.nilai)}</td></tr>`).join('')}`
      : `<tr><th colspan="2">${judul}</th></tr><tr><td colspan="2">Tidak ada data pada periode ini.</td></tr>`;
  const nonOpHtml = nonOp.some(x => x.nilai !== 0) ? baris('Beban Non-Operasional (bukan OPEX)', nonOp) : '';
  return `<table>${baris('Pendapatan', income)}${baris('OPEX', opex)}${nonOpHtml}</table>`;
}

export function htmlKinerjaKeuangan(d: DataKinerjaKeuangan): string {
  const label = esc(d.periode.label);
  const income = d.komposisi?.income ?? [];
  const opex = d.komposisi?.opex ?? [];
  const kategori = d.perKategori.length
    ? d.perKategori.map(k => `<tr><td>${esc(k.kategori)}</td><td>${rupiah(k.total)}</td></tr>`).join('')
    : '<tr><td>-</td><td>Rp0</td></tr>';
  const transaksi = d.transaksi.map(t =>
    `<tr><td>${tgl(t.tanggal)}</td><td>${esc(t.debit)}</td><td>${esc(t.kredit)}</td><td>${rupiah(t.nominal)}</td><td>${esc(teksTgl(t.keterangan))}</td></tr>`).join('');

  const isi = `
${kepalaLaporan('LAPORAN KINERJA KEUANGAN', 'Kost Tiga Dara Putri UGM', `Periode: ${label}   |   Dibuat: ${waktuWib(d.dibuat, true)}`)}
<p>Catatan: ini rekap kinerja kas &amp; laba bulanan. Laporan akuntansi formal (Laba Rugi, Neraca, Arus Kas) tetap dihasilkan melalui modul Laporan Keuangan.</p>
<h3>A. Indikator Kinerja Keuangan — ${label}</h3>
${scorecardHtml(d.kpi)}
<h3>Ringkasan Visual — ${label}</h3>
${kartuAngka([
  { label: 'Pendapatan', nilai: rupiah(d.pendapatan) }, { label: 'OPEX', nilai: rupiah(d.beban) }, { label: 'Laba Bersih', nilai: rupiah(d.laba) },
  { label: 'Kas Masuk', nilai: rupiah(d.kasMasuk) }, { label: 'Kas Keluar', nilai: rupiah(d.kasKeluar) }, { label: 'Arus Kas Bersih', nilai: rupiah(d.arusBersih) },
])}
${barisDonut([
  donutKartu('Komposisi OPEX', gabungSegmen(opex), rupiahRingkas(d.beban), true),
  donutKartu('Komposisi Pendapatan', gabungSegmen(income), rupiahRingkas(d.pendapatan), true),
  donutKartu('Pengeluaran per Kategori', gabungSegmen(d.perKategori.map(k => ({ label: k.kategori, nilai: k.total }))), rupiahRingkas(d.perKategori.reduce((s, k) => s + Math.max(0, k.total), 0)), true),
])}
${barisGrafik([
  barVertikalKartu('Pendapatan, OPEX, dan Laba', [{ label: 'Pendapatan', nilai: d.pendapatan }, { label: 'OPEX', nilai: d.beban }, { label: 'Laba Bersih', nilai: d.laba }], { uang: true }),
  barVertikalKartu('Arus Kas', [{ label: 'Kas Masuk', nilai: d.kasMasuk }, { label: 'Kas Keluar', nilai: d.kasKeluar }, { label: 'Bersih', nilai: d.arusBersih }], { uang: true }),
  garisKartu('Kas Masuk dan Kas Keluar Harian', [
    { nama: 'Kas masuk', warna: WARNA_SERI.utama, titik: d.harianKas?.masuk ?? [] },
    { nama: 'Kas keluar', warna: WARNA_SERI.kedua, titik: d.harianKas?.keluar ?? [] },
  ], { uang: true }),
])}
<h3>B. Kinerja Arus Kas</h3>
${kv([['Kas Masuk', rupiah(d.kasMasuk)], ['Kas Keluar', rupiah(d.kasKeluar)], ['Arus Kas Bersih', rupiah(d.arusBersih)], ['Jumlah Transaksi', String(d.jumlahTransaksi)]])}
<h3>C. Pengeluaran per Kategori</h3>
<table><tr><th>Kategori</th><th>Total Pengeluaran</th></tr>${kategori}</table>
<h3>Rincian Pendapatan dan Beban per Akun</h3>
${rincianAkun(income, opex, d.komposisi?.nonOp)}
<h3>D. Rincian Transaksi</h3>
<table><tr><th>Tgl</th><th>Debit</th><th>Kredit</th><th>Nominal</th><th>Keterangan</th></tr>${transaksi}</table>
${d.transaksi.length ? '' : '<p>Tidak ada transaksi pada periode ini.</p>'}
<table style="border:none;margin-top:24pt"><tr>
<td style="border:none;width:50%">Dibuat oleh,<br><br><br><br>(________________)<br>Staf Divisi</td>
<td style="border:none;width:50%">Mengetahui,<br><br><br><br>(________________)<br>Pengelola Kost</td>
</tr></table>`;
  return kerangkaDokumen(isi, 'admin');
}
