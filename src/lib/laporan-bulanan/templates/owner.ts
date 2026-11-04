import type { DataOwner } from '../builders/owner';
import { esc, rupiah, tgl, waktuWib } from '../format';
import { ringkasanHtml } from '../ringkasan';
import { kerangkaDokumen } from '../shell';

const tabel = (kepala: string[], baris: string[][], kosong: string) =>
  baris.length
    ? `<table><tr>${kepala.map(k => `<th>${k}</th>`).join('')}</tr>${baris.map(b => `<tr>${b.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`
    : `<p>${kosong}</p>`;

export function htmlOwner(d: DataOwner): string {
  const label = esc(d.periode.label);
  const k = d.keuangan;
  const o = d.operasional;

  const isi = `
<h1 style="text-align:center">KOST TIGA DARA PUTRI UGM</h1>
<h2 style="text-align:center">Laporan Owner Review Bulanan</h2>
<p style="text-align:center">Periode: ${label}</p>
<p style="text-align:center">Dibuat otomatis ${waktuWib(d.dibuat, true)} · Sumber: Database Kost Tiga Dara</p>
<h2>1. Ringkasan Eksekutif</h2>
${ringkasanHtml(d.ringkasan)}
<div style="page-break-after:always"></div>
<h2>2. Hunian &amp; Penyewa</h2>
<h3>Penghuni Baru Masuk — ${label}</h3>
${tabel(['Nama', 'Kamar', 'Institusi', 'Tanggal Masuk'],
  d.masuk.map(m => [esc(m.nama), esc(m.kamar), esc(m.institusi), tgl(m.tglMasuk)]),
  'Tidak ada penghuni baru tercatat pada periode ini.')}
<h3>Penghuni Keluar — ${label}</h3>
${tabel(['Nama', 'Kamar', 'Tanggal Keluar'],
  d.keluar.map(m => [esc(m.nama), esc(m.kamar), tgl(m.tglKeluar)]),
  'Tidak ada penghuni keluar tercatat pada periode ini.')}
<h2>3. Keuangan — ${label}</h2>
<table><tr><th>Indikator</th><th>Nilai</th></tr>
<tr><td>Pendapatan diakui</td><td>${rupiah(k.pendapatan)}</td></tr>
<tr><td>Beban tercatat</td><td>${rupiah(k.beban)}</td></tr>
<tr><td>Laba bersih</td><td>${rupiah(k.laba)}</td></tr>
<tr><td>Kas masuk</td><td>${rupiah(k.kasMasuk)}</td></tr>
<tr><td>Kas keluar</td><td>${rupiah(k.kasKeluar)}</td></tr>
<tr><td>Arus kas bersih</td><td>${rupiah(k.arusBersih)}</td></tr></table>
<h3>Rincian Transaksi pada Periode</h3>
${tabel(['Tanggal', 'Keterangan', 'Debit', 'Kredit', 'Nominal'],
  k.transaksi.map(t => [tgl(t.tanggal), esc(t.keterangan), esc(t.debit), esc(t.kredit), rupiah(t.nominal)]),
  'Tidak ada transaksi keuangan tercatat pada periode ini.')}
<h2>4. Operasional: Inspeksi, Perawatan &amp; Perbaikan — ${label}</h2>
<table><tr><th>Indikator</th><th>Jumlah</th></tr>
<tr><td>Perbaikan (korektif) selesai</td><td>${o.korektifSelesai}</td></tr>
<tr><td>Perawatan (preventif) selesai</td><td>${o.preventifSelesai}</td></tr>
<tr><td>Inspeksi fasilitas</td><td>${o.inspeksi}</td></tr>
<tr><td>Pekerjaan darurat</td><td>${o.darurat}</td></tr>
<tr><td>Total biaya</td><td>${rupiah(o.biaya)}</td></tr></table>
<h3>Rincian Pekerjaan pada Periode</h3>
${tabel(['Tanggal', 'Jenis', 'Item / Lokasi', 'Biaya', 'Status'],
  o.rincian.map(r => [tgl(r.tanggal), esc(r.jenis), esc(r.item), rupiah(r.biaya), esc(r.status)]),
  'Tidak ada pekerjaan tercatat pada periode ini.')}
<h2>5. Marketing — ${label}</h2>
${d.marketing.leads + d.marketing.booking === 0
  ? '<p>Tidak ada data leads marketing pada periode ini.</p>'
  : `<table><tr><th>Indikator</th><th>Jumlah</th></tr><tr><td>Leads</td><td>${d.marketing.leads}</td></tr><tr><td>Booking</td><td>${d.marketing.booking}</td></tr></table>`}
<h2>6. Kualitas Data &amp; Rekomendasi</h2>
<ul>${d.rekomendasi.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
<p style="text-align:center;font-size:9pt;margin-top:18pt">Laporan otomatis · Kost Tiga Dara Putri UGM · Hanya memuat data dalam periode laporan.</p>`;
  return kerangkaDokumen(isi, 'owner');
}
