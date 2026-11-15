import type { KpiData } from '@/lib/dashboard/kpi';
import { revpar } from '@/lib/dashboard/kpi-calc';
import { esc, rupiah } from './format';

/* Scorecard KPI untuk laporan bulanan. Angkanya datang dari loadKpi (rumus yang sama dengan Dashboard);
   file ini hanya memberi target SOW (docs/SOW-DRAFT.md) dan menentukan status tercapai/belum.
   Murni, tanpa database. */

export type StatusKpi = 'tercapai' | 'belum' | 'info';
export interface BarisKpi { nama: string; nilai: string; target: string; status: StatusKpi }

export interface DataKpi {
  kpi: KpiData;
  /** Pendapatan kotor (sebelum diskon), sama dengan kartu Pendapatan di Dashboard. */
  pendapatan: number;
  pendapatanSewa: number;
  beban: number;
  laba: number;
  diskon: number;
  kapasitas: number;
  kamarIsi: number;
  /** Jumlah hari pada periode (28-31). */
  hari: number;
}

// Target per SOW Properti A. Satu tempat supaya mudah diubah bila SOW direvisi.
const T = {
  pendapatan: 26_000_000, laba: 15_000_000, diskonPct: 10, opexKamar: 300_000, tutupBuku: 1, tunggakan: 2,
  collection: 100, dokumen: 100, responsPengaduanJam: 1,
  booking: 1, konversi: 90, batal: 20, responsLeadsMenit: 15, renewal: 100, lamaSewa: 3, vacancy: 30, okupansi: 100,
  leadsMinggu: 10, pencapaian: 80, cpl: 25_000, cac: 50_000, roi: 100, engagement: 70, konsistensi: 100,
  sla: 100, resolusiHari: 1, preventif: 100, inspeksi: 100, kamarSiapHari: 1, tiketBerulang: 2, biayaKamar: 150_000,
};

const koma = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
const persen = (n: number) => `${koma(n)} %`;
const satuan = (s: string) => (n: number) => `${koma(n)} ${s}`;
const angka = (n: number) => n.toLocaleString('id-ID');

type Arah = 'min' | 'max';

/** arah 'min' = nilai harus >= target; 'max' = nilai harus <= target. Tanpa target/arah atau tanpa data: status 'info'. */
function baris(nama: string, nilai: number | null | undefined, fmt: (n: number) => string, target?: number, arah?: Arah): BarisKpi {
  const teksTarget = target == null || !arah ? '-' : `${arah === 'max' ? '≤' : '≥'} ${fmt(target)}`;
  if (nilai == null) return { nama, nilai: '—', target: teksTarget, status: 'info' };
  const ok = target == null || !arah ? null : arah === 'min' ? nilai >= target : nilai <= target;
  return { nama, nilai: fmt(nilai), target: teksTarget, status: ok === null ? 'info' : ok ? 'tercapai' : 'belum' };
}

const pctDari = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

const keuangan = (d: DataKpi) => ({
  margin: pctDari(d.laba, d.pendapatan),
  diskonPct: pctDari(d.diskon, d.pendapatan),
  opexKamar: d.kapasitas > 0 ? Math.round(d.beban / d.kapasitas) : null,
});
const okupansi = (d: DataKpi) => pctDari(d.kamarIsi, d.kapasitas);
const kamarKosong = (d: DataKpi) => Math.max(0, d.kapasitas - d.kamarIsi);

export function barisAdmin(d: DataKpi): BarisKpi[] {
  const a = d.kpi.admin;
  return [
    baris('Dokumen Penghuni Lengkap', a?.dokumenLengkap, persen, T.dokumen, 'min'),
    baris('Respons Pengaduan', a?.responsPengaduanJam, satuan('jam'), T.responsPengaduanJam, 'max'),
    { ...baris('Kepuasan Penghuni (CSAT)', a?.csat, n => `${koma(n)} / 5`), target: 'Skala 1–5' },
    baris('Kamar Kosong (akhir periode)', kamarKosong(d), satuan('kamar'), 0, 'max'),
  ];
}

export function barisKeuangan(d: DataKpi): BarisKpi[] {
  const a = d.kpi.admin;
  const k = keuangan(d);
  const ag = a?.aging;
  return [
    baris('Pendapatan', d.pendapatan, rupiah, T.pendapatan, 'min'),
    baris('Laba Bersih', d.laba, rupiah, T.laba, 'min'),
    baris('Margin Laba Bersih', k.margin, persen),
    baris('Total Beban', d.beban, rupiah),
    { ...baris('Total Diskon (% dari pendapatan)', k.diskonPct, persen, T.diskonPct, 'max'), nilai: k.diskonPct == null ? '—' : `${rupiah(d.diskon)} (${persen(k.diskonPct)})` },
    baris('Collection Rate', a?.collectionRate, persen, T.collection, 'min'),
    baris('OPEX per Kamar / Bulan', k.opexKamar, rupiah, T.opexKamar, 'max'),
    baris('Tutup Buku (hari kerja setelah akhir bulan)', a?.tutupBukuHariKerja, satuan('hari'), T.tutupBuku, 'max'),
    baris('Penghuni Menunggak', ag?.total, angka, T.tunggakan, 'max'),
    baris('Nominal Tunggakan (estimasi)', ag?.nominal, rupiah),
    baris('Tunggakan 1–7 hari', ag?.hari1_7, angka),
    baris('Tunggakan 8–14 hari', ag?.hari8_14, angka),
    baris('Tunggakan 15–30 hari', ag?.hari15_30, angka),
    baris('Tunggakan lebih dari 30 hari', ag?.lebih30, angka),
  ];
}

export function barisSales(d: DataKpi): BarisKpi[] {
  const s = d.kpi.sales;
  return [
    baris('Booking Baru', s?.bookingBaru, angka, T.booking, 'min'),
    baris('Survey', s?.survey, angka),
    baris('Konversi Leads → Survey', s?.konversiLeadsSurvey, persen, T.konversi, 'min'),
    baris('Konversi Survey → Booking', s?.konversiSurveyBooking, persen, T.konversi, 'min'),
    baris('Cancellation Rate', s?.cancelRate, persen, T.batal, 'max'),
    baris('Respons Leads Pertama', s?.responsLeadsMenit, satuan('menit'), T.responsLeadsMenit, 'max'),
    baris('Renewal Rate', s?.renewalRate, persen, T.renewal, 'min'),
    baris('Rata-Rata Lama Sewa', s?.lamaSewaBulan, satuan('bulan'), T.lamaSewa, 'min'),
    baris('Vacancy Days', s?.vacancyHari, satuan('hari'), T.vacancy, 'max'),
    { ...baris('Waiting List (antrean saat ini)', s?.waitingList, satuan('orang')), target: '5 orang' },
    baris('Okupansi (akhir periode)', okupansi(d), persen, T.okupansi, 'min'),
  ];
}

export function barisMarketing(d: DataKpi): BarisKpi[] {
  const m = d.kpi.marketing;
  const perMinggu = m ? Math.round((m.leads / (d.hari / 7)) * 10) / 10 : null;
  return [
    baris('Leads Masuk', m?.leads, angka),
    baris('Leads per Minggu', perMinggu, koma, T.leadsMinggu, 'min'),
    baris('Pencapaian Target Leads', m?.pencapaianTarget, persen, T.pencapaian, 'min'),
    baris('CPL', m?.cpl, rupiah, T.cpl, 'max'),
    baris('CAC', m?.cac, rupiah, T.cac, 'max'),
    baris('ROI Promosi', m?.roi, persen, T.roi, 'min'),
    baris('Engagement Rate', m?.engagement, persen, T.engagement, 'min'),
    baris('Konsistensi Posting', m?.konsistensi, persen, T.konsistensi, 'min'),
    baris('Funnel Konten: View (jangkauan)', m?.view, angka),
    baris('Funnel Konten: Action (like, komentar, share)', m?.aksi, angka),
    baris('Funnel Konten: Leads', m?.leads, angka),
  ];
}

export function barisOps(d: DataKpi): BarisKpi[] {
  const o = d.kpi.ops;
  return [
    baris('Kepatuhan SLA Tiket', o?.slaPatuh, persen, T.sla, 'min'),
    baris('Resolution Time', o?.resolusiHari, satuan('hari'), T.resolusiHari, 'max'),
    baris('Kepatuhan Jadwal Preventif', o?.kepatuhanPreventif, persen, T.preventif, 'min'),
    baris('Kepatuhan Inspeksi Harian', o?.kepatuhanInspeksi, persen, T.inspeksi, 'min'),
    baris('Waktu Prepare Kamar', o?.kamarSiapHari, satuan('hari'), T.kamarSiapHari, 'max'),
    baris('Tiket Berulang', o?.tiketBerulang, satuan('kasus'), T.tiketBerulang, 'max'),
    baris('Biaya Perbaikan per Kamar', o?.biayaPerKamar, rupiah, T.biayaKamar, 'max'),
  ];
}

export function barisOwner(d: DataKpi): BarisKpi[] {
  const k = keuangan(d);
  const rev = revpar(d.pendapatanSewa, d.kapasitas, d.hari);
  return [
    baris('Pendapatan Kotor', d.pendapatan, rupiah, T.pendapatan, 'min'),
    baris('Laba Bersih', d.laba, rupiah, T.laba, 'min'),
    baris('Margin Laba Bersih', k.margin, persen),
    baris('Okupansi (akhir periode)', okupansi(d), persen, T.okupansi, 'min'),
    baris('Kamar Kosong (akhir periode)', kamarKosong(d), satuan('kamar'), 0, 'max'),
    baris('RevPAR (pendapatan sewa per kamar per hari)', rev, rupiah),
    baris('OPEX per Kamar / Bulan', k.opexKamar, rupiah, T.opexKamar, 'max'),
    { ...baris('Total Diskon (% dari pendapatan)', k.diskonPct, persen, T.diskonPct, 'max'), nilai: k.diskonPct == null ? '—' : `${rupiah(d.diskon)} (${persen(k.diskonPct)})` },
    baris('Tiket Belum Selesai (dibuat pada periode)', d.kpi.ops?.tiketAktif, angka),
    { ...baris('Kepuasan Penghuni (CSAT)', d.kpi.admin?.csat, n => `${koma(n)} / 5`), target: 'Skala 1–5' },
  ];
}

export interface RingkasDivisi { divisi: string; tercapai: number; belum: number; tanpaStatus: number; belumDaftar: BarisKpi[] }

/** Rekap pencapaian per divisi untuk Owner Review. */
export function ringkasPerDivisi(d: DataKpi): RingkasDivisi[] {
  const daftar: [string, BarisKpi[]][] = [
    ['Admin', barisAdmin(d)], ['Keuangan', barisKeuangan(d)], ['Sales', barisSales(d)],
    ['Marketing', barisMarketing(d)], ['Operasional', barisOps(d)],
  ];
  return daftar.map(([divisi, rows]) => ({
    divisi,
    tercapai: rows.filter(r => r.status === 'tercapai').length,
    belum: rows.filter(r => r.status === 'belum').length,
    tanpaStatus: rows.filter(r => r.status === 'info').length,
    belumDaftar: rows.filter(r => r.status === 'belum'),
  }));
}

const LABEL: Record<StatusKpi, string> = { tercapai: 'Tercapai', belum: 'Belum tercapai', info: '–' };
const PIL: Record<StatusKpi, string> = { tercapai: 'pil pil-baik', belum: 'pil pil-buruk', info: 'pil pil-netral' };

/** Tabel scorecard. Kelas .pil hanya bergaya di tema Owner; di tema lain tampil sebagai teks biasa. */
export function scorecardHtml(rows: BarisKpi[]): string {
  const isi = rows.map(r =>
    `<tr><td>${esc(r.nama)}</td><td>${esc(r.nilai)}</td><td>${esc(r.target)}</td><td><span class="${PIL[r.status]}">${LABEL[r.status]}</span></td></tr>`).join('');
  return `<table><tr><th>KPI</th><th>Capaian</th><th>Target</th><th>Status</th></tr>${isi}</table>
<p class="catatan">Target mengacu pada SOW divisi. Angka dihitung dengan rumus yang sama dengan Dashboard. “—” berarti belum ada data pada periode ini; “–” berarti indikator tanpa target.</p>`;
}
