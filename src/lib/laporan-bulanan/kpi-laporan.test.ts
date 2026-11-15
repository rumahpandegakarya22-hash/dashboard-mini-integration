import test from 'node:test';
import assert from 'node:assert/strict';
import type { KpiData } from '@/lib/dashboard/kpi';
import {
  barisAdmin, barisKeuangan, barisMarketing, barisOps, barisOwner, barisSales, ringkasPerDivisi, scorecardHtml,
  type DataKpi,
} from './kpi-laporan';

const AGING = { hari1_7: 1, hari8_14: 0, hari15_30: 1, lebih30: 0, total: 2, nominal: 2_400_000 };

function dasar(kpi: KpiData = {}): DataKpi {
  return { kpi, pendapatan: 26_000_000, pendapatanSewa: 24_000_000, beban: 9_000_000, laba: 17_000_000, diskon: 2_600_000, kapasitas: 30, kamarIsi: 30, hari: 30 };
}
const cari = (rows: { nama: string }[], nama: string) => {
  const r = rows.find(x => x.nama === nama);
  assert.ok(r, `baris tidak ada: ${nama}`);
  return r as ReturnType<typeof barisAdmin>[number];
};

test('arah target: min harus >= target, max harus <= target; batas tepat dianggap tercapai', () => {
  const k = barisKeuangan(dasar());
  assert.equal(cari(k, 'Pendapatan').status, 'tercapai');
  assert.equal(cari(k, 'Pendapatan').target, '≥ Rp26.000.000');
  assert.equal(cari(k, 'Laba Bersih').status, 'tercapai');
  assert.equal(cari(k, 'OPEX per Kamar / Bulan').nilai, 'Rp300.000');
  assert.equal(cari(k, 'OPEX per Kamar / Bulan').status, 'tercapai');
  assert.equal(cari(k, 'OPEX per Kamar / Bulan').target, '≤ Rp300.000');
  const lebih = barisKeuangan({ ...dasar(), beban: 9_000_030 });
  assert.equal(cari(lebih, 'OPEX per Kamar / Bulan').status, 'belum');
});

test('diskon: nilai memuat rupiah dan persen, status dari persen (<= 10 %)', () => {
  const d = cari(barisKeuangan(dasar()), 'Total Diskon (% dari pendapatan)');
  assert.equal(d.nilai, 'Rp2.600.000 (10 %)');
  assert.equal(d.status, 'tercapai');
  const besar = cari(barisKeuangan({ ...dasar(), diskon: 3_000_000 }), 'Total Diskon (% dari pendapatan)');
  assert.equal(besar.status, 'belum');
});

test('tanpa data: nilai —, status info, bukan 0 yang menyesatkan', () => {
  const a = barisAdmin(dasar({}));
  assert.deepEqual([cari(a, 'Dokumen Penghuni Lengkap').nilai, cari(a, 'Dokumen Penghuni Lengkap').status], ['—', 'info']);
  const s = barisSales(dasar({}));
  assert.equal(cari(s, 'Respons Leads Pertama').nilai, '—');
  const m = barisMarketing(dasar({}));
  assert.equal(cari(m, 'CAC').status, 'info');
  assert.equal(cari(m, 'Leads per Minggu').nilai, '—');
});

test('pendapatan nol: margin dan persen diskon kosong, tanpa NaN/Infinity', () => {
  const k = barisKeuangan({ ...dasar(), pendapatan: 0, laba: 0, beban: 0, diskon: 0 });
  assert.equal(cari(k, 'Margin Laba Bersih').nilai, '—');
  assert.equal(cari(k, 'Total Diskon (% dari pendapatan)').nilai, '—');
  assert.ok(!JSON.stringify(k).match(/NaN|Infinity/));
});

test('keuangan: aging dan tunggakan dari KPI admin', () => {
  const k = barisKeuangan(dasar({ admin: { collectionRate: 100, aging: AGING, dokumenLengkap: 90, tutupBukuHariKerja: 2, responsPengaduanJam: 0.5, csat: 4.5 } }));
  assert.equal(cari(k, 'Penghuni Menunggak').nilai, '2');
  assert.equal(cari(k, 'Penghuni Menunggak').status, 'tercapai');
  assert.equal(cari(k, 'Nominal Tunggakan (estimasi)').nilai, 'Rp2.400.000');
  assert.equal(cari(k, 'Tunggakan 15–30 hari').nilai, '1');
  assert.equal(cari(k, 'Collection Rate').status, 'tercapai');
  assert.equal(cari(k, 'Tutup Buku (hari kerja setelah akhir bulan)').status, 'belum');
});

test('admin: CSAT hanya info dengan target skala; kamar kosong dari kamar isi', () => {
  const a = barisAdmin({ ...dasar({ admin: { collectionRate: null, aging: AGING, dokumenLengkap: 100, tutupBukuHariKerja: 1, responsPengaduanJam: 1.5, csat: 4.2 } }), kamarIsi: 28 });
  const csat = cari(a, 'Kepuasan Penghuni (CSAT)');
  assert.deepEqual([csat.nilai, csat.target, csat.status], ['4,2 / 5', 'Skala 1–5', 'info']);
  assert.equal(cari(a, 'Respons Pengaduan').status, 'belum');
  assert.equal(cari(a, 'Kamar Kosong (akhir periode)').nilai, '2 kamar');
  assert.equal(cari(a, 'Kamar Kosong (akhir periode)').status, 'belum');
});

test('sales: konversi, cancel, waiting list tanpa status, okupansi dari kamar', () => {
  const s = barisSales({
    ...dasar({ sales: { konversiSurveyBooking: 90, konversiLeadsSurvey: 85, vacancyHari: 12, renewalRate: 100, responsLeadsMenit: 10, waitingList: 3, bookingBaru: 2, survey: 5, cancelRate: 25, lamaSewaBulan: 3.4 } }),
    kamarIsi: 27,
  });
  assert.equal(cari(s, 'Konversi Survey → Booking').status, 'tercapai');
  assert.equal(cari(s, 'Konversi Leads → Survey').status, 'belum');
  assert.equal(cari(s, 'Cancellation Rate').status, 'belum');
  assert.equal(cari(s, 'Respons Leads Pertama').nilai, '10 menit');
  assert.equal(cari(s, 'Rata-Rata Lama Sewa').nilai, '3,4 bulan');
  const wl = cari(s, 'Waiting List (antrean saat ini)');
  assert.deepEqual([wl.nilai, wl.target, wl.status], ['3 orang', '5 orang', 'info']);
  assert.equal(cari(s, 'Okupansi (akhir periode)').nilai, '90 %');
});

test('marketing: leads per minggu dihitung dari jumlah hari periode', () => {
  const kpi: KpiData = { marketing: { cpl: 20_000, cac: 60_000, roi: 120, pencapaianTarget: 80, engagement: 70, konsistensi: 100, bookingBaru: 1, view: 5000, aksi: 400, leads: 30 } };
  const m = barisMarketing(dasar(kpi));
  assert.equal(cari(m, 'Leads per Minggu').nilai, '7'); // 30 leads / (30 hari / 7)
  assert.equal(cari(m, 'Leads per Minggu').status, 'belum');
  assert.equal(cari(m, 'CPL').status, 'tercapai');
  assert.equal(cari(m, 'CAC').status, 'belum');
  assert.equal(cari(m, 'Engagement Rate').status, 'tercapai');
  assert.equal(cari(m, 'Funnel Konten: View (jangkauan)').nilai, '5.000');
  assert.equal(cari(m, 'Funnel Konten: Leads').status, 'info');
});

test('operasional: tujuh KPI dengan arah yang benar', () => {
  const o = barisOps(dasar({ ops: { slaPatuh: 100, rasioPreventif: 90, tiketBerulang: 3, biayaPerKamar: 120_000, kepatuhanPreventif: 100, kepatuhanInspeksi: 96.7, kamarSiapHari: 1, resolusiHari: 0.5, tiketAktif: 4 } }));
  assert.equal(o.length, 7);
  assert.equal(cari(o, 'Kepatuhan SLA Tiket').status, 'tercapai');
  assert.equal(cari(o, 'Resolution Time').status, 'tercapai');
  assert.equal(cari(o, 'Kepatuhan Inspeksi Harian').status, 'belum');
  assert.equal(cari(o, 'Tiket Berulang').status, 'belum');
  assert.equal(cari(o, 'Biaya Perbaikan per Kamar').status, 'tercapai');
  assert.equal(cari(o, 'Waktu Prepare Kamar').nilai, '1 hari');
});

test('owner: RevPAR dari pendapatan sewa, tiket belum selesai, tanpa NaN', () => {
  const rows = barisOwner(dasar({ ops: { slaPatuh: null, rasioPreventif: null, tiketBerulang: 0, biayaPerKamar: null, kepatuhanPreventif: null, kepatuhanInspeksi: null, kamarSiapHari: null, resolusiHari: null, tiketAktif: 4 } }));
  assert.equal(cari(rows, 'RevPAR (pendapatan sewa per kamar per hari)').nilai, 'Rp26.667'); // 24 jt / (30 x 30)
  assert.equal(cari(rows, 'Tiket Belum Selesai (dibuat pada periode)').nilai, '4');
  assert.equal(cari(rows, 'Okupansi (akhir periode)').status, 'tercapai');
  assert.equal(cari(rows, 'Kamar Kosong (akhir periode)').status, 'tercapai');
  assert.ok(!JSON.stringify(rows).match(/NaN|Infinity/));
});

test('ringkasPerDivisi: lima divisi, hitungan dan daftar belum tercapai konsisten', () => {
  const r = ringkasPerDivisi(dasar({ admin: { collectionRate: 80, aging: AGING, dokumenLengkap: 100, tutupBukuHariKerja: 1, responsPengaduanJam: 3, csat: 4 } }));
  assert.deepEqual(r.map(x => x.divisi), ['Admin', 'Keuangan', 'Sales', 'Marketing', 'Operasional']);
  const admin = r[0];
  assert.equal(admin.tercapai + admin.belum + admin.tanpaStatus, barisAdmin(dasar({ admin: { collectionRate: 80, aging: AGING, dokumenLengkap: 100, tutupBukuHariKerja: 1, responsPengaduanJam: 3, csat: 4 } })).length);
  assert.equal(admin.belumDaftar.length, admin.belum);
  assert.ok(admin.belumDaftar.some(b => b.nama === 'Respons Pengaduan'));
  assert.ok(r[1].belumDaftar.some(b => b.nama === 'Collection Rate'));
});

test('scorecardHtml: escape, label status, dan catatan sumber', () => {
  const h = scorecardHtml([
    { nama: '<b>KPI</b>', nilai: '1 & 2', target: '≥ 3', status: 'belum' },
    { nama: 'Lain', nilai: '—', target: '-', status: 'info' },
  ]);
  assert.ok(!h.includes('<b>KPI'));
  assert.ok(h.includes('&lt;b&gt;KPI&lt;/b&gt;'));
  assert.ok(h.includes('1 &amp; 2'));
  assert.match(h, /<th>KPI<\/th><th>Capaian<\/th><th>Target<\/th><th>Status<\/th>/);
  assert.match(h, /<span class="pil pil-buruk">Belum tercapai<\/span>/);
  assert.match(h, /<span class="pil pil-netral">–<\/span>/);
  assert.match(h, /rumus yang sama dengan Dashboard/);
});
