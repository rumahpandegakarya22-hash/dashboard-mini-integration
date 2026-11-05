import test from 'node:test';
import assert from 'node:assert/strict';
import type { DataOwner } from '../builders/owner';
import { susunRekomendasi, ekstrakKeuangan } from '../builders/owner';
import type { LaporanTable } from '@/lib/laporan/generator';
import { htmlOwner } from './owner';
import { parsePeriode } from '../periode';

const periode = parsePeriode('2026-06', new Date('2026-11-02'));

function dasar(): Omit<DataOwner, 'rekomendasi'> {
  return {
    periode,
    dibuat: new Date('2026-07-03T03:00:00Z'),
    masuk: [{ nama: 'Rina', kamar: '5', institusi: 'UGM', tglMasuk: '2026-06-10' }],
    keluar: [{ nama: 'Sari', kamar: '7', tglKeluar: '2026-06-20' }],
    keuangan: {
      pendapatan: 3000000, beban: 3175000, laba: -175000,
      kasMasuk: 3000000, kasKeluar: 500000, arusBersih: 2500000,
      transaksi: [{ tanggal: '2026-06-02', keterangan: 'Sewa Rina', debit: 'Kas', kredit: 'Pendapatan Sewa', nominal: 3000000 }],
    },
    operasional: {
      korektifSelesai: 2, preventifSelesai: 1, inspeksi: 1, darurat: 1, biaya: 250000,
      rincian: [
        { tanggal: '2026-06-03', jenis: 'Korektif', item: 'AC Kamar 5', biaya: 250000, status: 'Selesai' },
        { tanggal: '2026-06-04', jenis: 'Korektif', item: 'Keran', biaya: 0, status: 'Selesai' },
        { tanggal: '2026-06-05', jenis: 'Preventif', item: 'Servis AC', biaya: 0, status: 'Selesai' },
        { tanggal: '2026-06-06', jenis: 'Inspeksi', item: 'Dapur', biaya: 0, status: 'Terdokumentasi' },
      ],
    },
    marketing: { leads: 4, booking: 1 },
    ringkasan: {
      kini: { pendapatan: 3000000, beban: 3175000, laba: -175000, diskon: 100000, kamarIsi: 28, kamarKosong: 2, okupansi: 93.3 },
      lalu: { pendapatan: 2500000, beban: 3000000, laba: -500000, diskon: 0, kamarIsi: 27, kamarKosong: 3, okupansi: 90 },
      labelLalu: 'Mei 2026',
      opex: [{ label: 'Listrik', nilai: 2000000 }, { label: 'Gaji Karyawan', nilai: 1175000 }],
      income: [{ label: 'Penerimaan Sewa Kamar', nilai: 3000000 }],
      totalKamar: 30,
    },
  };
}
const lengkap = (): DataOwner => { const d = dasar(); return { ...d, rekomendasi: susunRekomendasi(d) }; };

test('htmlOwner memuat judul dan bagian berurutan', () => {
  const html = htmlOwner(lengkap());
  const urutan = [
    'KOST TIGA DARA PUTRI UGM', 'Laporan Owner Review Bulanan', 'Periode: Juni 2026',
    '1. Ringkasan Eksekutif', '2. Hunian &amp; Penyewa',
    'Penghuni Baru Masuk — Juni 2026', 'Penghuni Keluar — Juni 2026',
    '3. Keuangan — Juni 2026', 'Rincian Transaksi pada Periode',
    '4. Operasional: Inspeksi, Perawatan &amp; Perbaikan — Juni 2026',
    '5. Marketing — Juni 2026', '6. Kualitas Data &amp; Rekomendasi',
    'Laporan otomatis · Kost Tiga Dara Putri UGM · Hanya memuat data dalam periode laporan.',
  ];
  let pos = 0;
  for (const s of urutan) {
    const i = html.indexOf(s, pos);
    assert.ok(i >= 0, `tidak ditemukan berurutan: ${s}`);
    pos = i + s.length;
  }
});

test('header memuat tanggal dibuat dan sumber database', () => {
  const html = htmlOwner(lengkap());
  assert.match(html, /Dibuat otomatis 03\/07\/2026 10:00 · Sumber: Database Kost Tiga Dara/);
});

test('ringkasan eksekutif visual: kartu, pil, donut, lalu halaman baru', () => {
  const html = htmlOwner(lengkap());
  const ringkas = html.slice(html.indexOf('1. Ringkasan Eksekutif'), html.indexOf('2. Hunian'));
  for (const label of ['Pendapatan Neto', 'Laba Bersih', 'OPEX', 'Total Diskon', 'Okupansi', 'Kamar Isi', 'Kamar Kosong']) {
    assert.ok(ringkas.includes(label), label);
  }
  assert.equal((ringkas.match(/class="kartu /g) ?? []).length, 7);
  assert.equal((ringkas.match(/<svg width="130"/g) ?? []).length, 3);
  assert.ok(ringkas.includes('vs bln lalu') && ringkas.includes('Pembanding: Mei 2026'));
  assert.ok(ringkas.includes('page-break-after:always'));
  assert.ok(!ringkas.includes('Penghuni baru masuk bulan ini'));
});

test('data kosong tetap utuh dengan pesan kosong', () => {
  const d = { ...dasar(), masuk: [], keluar: [], marketing: { leads: 0, booking: 0 } };
  const html = htmlOwner({ ...d, rekomendasi: susunRekomendasi(d) });
  assert.match(html, /Tidak ada penghuni baru tercatat pada periode ini\./);
  assert.match(html, /Tidak ada penghuni keluar tercatat pada periode ini\./);
  assert.match(html, /Tidak ada data leads marketing pada periode ini\./);
  assert.ok(!html.split('<body>')[1].includes('NaN'));
});

test('angka negatif tampil -Rp175.000', () => {
  assert.ok(htmlOwner(lengkap()).includes('-Rp175.000'));
});

test('teks database di-escape', () => {
  const d = dasar();
  d.masuk[0].nama = '<script>x</script>';
  d.keuangan.transaksi[0].keterangan = 'A & "B"';
  const html = htmlOwner({ ...d, rekomendasi: [] });
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A &amp; &quot;B&quot;'));
});

test('susunRekomendasi: tanpa inspeksi menyarankan inspeksi', () => {
  const d = dasar(); d.operasional.inspeksi = 0;
  assert.ok(susunRekomendasi(d).some(r => /inspeksi/i.test(r)));
});

test('susunRekomendasi: dengan inspeksi tidak menyarankan inspeksi', () => {
  assert.ok(!susunRekomendasi(dasar()).some(r => /inspeksi/i.test(r)));
});

test('susunRekomendasi: transaksi kosong menyarankan input penerimaan sewa', () => {
  const d = dasar(); d.keuangan.transaksi = [];
  assert.ok(susunRekomendasi(d).some(r => /penerimaan sewa/i.test(r)));
});

test('susunRekomendasi: tanpa leads menyarankan isi rekap leads', () => {
  const d = dasar(); d.marketing.leads = 0;
  assert.ok(susunRekomendasi(d).some(r => /leads/i.test(r)));
});

test('susunRekomendasi: data lengkap menghasilkan satu pesan', () => {
  assert.equal(susunRekomendasi(dasar()).length, 1);
});

test('transaksi dan rincian pekerjaan kosong menampilkan pesan kosong', () => {
  const d = dasar();
  d.keuangan.transaksi = [];
  d.operasional.rincian = [];
  const html = htmlOwner({ ...d, rekomendasi: [] });
  assert.match(html, /Tidak ada transaksi keuangan tercatat pada periode ini\./);
  assert.match(html, /Tidak ada pekerjaan tercatat pada periode ini./);
});

test('tanggal kosong atau rusak tampil aman', () => {
  const d = dasar();
  d.masuk[0].tglMasuk = '';
  d.keluar[0].tglKeluar = '<b>';
  const html = htmlOwner({ ...d, rekomendasi: [] });
  assert.ok(!html.includes('undefined'));
  assert.ok(html.includes('&lt;b&gt;'));
  assert.ok(html.includes('<td>-</td>'));
});

test('susunRekomendasi: bentuk nol penuh memberi tiga saran', () => {
  const d = dasar();
  d.keuangan.transaksi = [];
  d.operasional.inspeksi = 0;
  d.marketing = { leads: 0, booking: 0 };
  assert.equal(susunRekomendasi(d).length, 3);
});

const tabelUji = (judul: string, baris: LaporanTable['baris']): LaporanTable => ({ judul, baris });
const LR_BULAN_RUGI = tabelUji('Laba Rugi', [
  { label: 'PENDAPATAN PENJUALAN', nilai: null, seksi: true },
  { label: 'Penerimaan Sewa Kamar', nilai: 1000000 },
  { label: 'Total Pendapatan', nilai: 1000000, bold: true },
  { label: 'LABA BERSIH', nilai: -175000, bold: true },
]);
const AK_UJI = tabelUji('Arus Kas', [
  { label: 'Arus Kas Awal Periode', nilai: 5000000, bold: true },
  { label: 'AKTIVITAS OPERASIONAL', nilai: null, seksi: true },
  { label: 'Penerimaan Sewa Kamar', nilai: 1000000 },
  { label: 'Pembayaran Operasional Lainnya', nilai: -1175000 },
  { label: 'Arus Kas Bersih Operasional', nilai: -175000, bold: true },
  { label: 'Kenaikan (Penurunan) Kas Bersih', nilai: -175000, bold: true },
  { label: 'Arus Kas Akhir Periode', nilai: 4825000, bold: true },
]);

test('ekstrakKeuangan: laba negatif, beban = pendapatan - laba', () => {
  assert.deepEqual(ekstrakKeuangan(LR_BULAN_RUGI, AK_UJI), {
    pendapatan: 1000000, beban: 1175000, laba: -175000,
    kasMasuk: 1000000, kasKeluar: 1175000, arusBersih: -175000,
  });
});

test('ekstrakKeuangan: bulan kosong (semua nol) tidak melempar', () => {
  const lr = tabelUji('Laba Rugi', [
    { label: 'Total Pendapatan', nilai: 0, bold: true },
    { label: 'LABA BERSIH', nilai: 0, bold: true },
  ]);
  const ak = tabelUji('Arus Kas', [
    { label: 'Arus Kas Awal Periode', nilai: 0, bold: true },
    { label: 'Penerimaan Sewa Kamar', nilai: 0 },
    { label: 'Kenaikan (Penurunan) Kas Bersih', nilai: 0, bold: true },
  ]);
  assert.deepEqual(ekstrakKeuangan(lr, ak), { pendapatan: 0, beban: 0, laba: 0, kasMasuk: 0, kasKeluar: 0, arusBersih: 0 });
});

test('ekstrakKeuangan: label wajib hilang -> melempar pesan jelas', () => {
  const tanpaLaba = tabelUji('Laba Rugi', [{ label: 'Total Pendapatan', nilai: 1, bold: true }]);
  assert.throws(() => ekstrakKeuangan(tanpaLaba, AK_UJI), /Baris "LABA BERSIH" tidak ditemukan di Laba Rugi\./);
  const tanpaKas = tabelUji('Arus Kas', []);
  assert.throws(() => ekstrakKeuangan(LR_BULAN_RUGI, tanpaKas), /Baris "Kenaikan \(Penurunan\) Kas Bersih" tidak ditemukan di Arus Kas\./);
});
