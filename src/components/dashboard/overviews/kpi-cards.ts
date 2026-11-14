/* Pembentuk kartu KPI SOW per halaman. Murni: terima angka, kembalikan StatCardData.
   Tiap kartu membawa `sub` (target atau satuan kedua) supaya ruangnya terisi informasi, bukan kosong. */

import type { StatCardData } from '@/components/ui/StatCard';
import { G } from '@/config/dashboard-palette';
import { fmtRpShort, type FinanceResult } from '@/lib/dashboard/views/finance';
import { hariPeriode, revpar, type Range } from '@/lib/dashboard/kpi-calc';
import type { KpiData } from '@/lib/dashboard/kpi';

const koma = (n: number) => String(n).replace('.', ',');
export const persen = (v: number | null | undefined): string => (v == null ? '—' : `${koma(v)} %`);
const angka = (v: number | null | undefined, satuan: string): string => (v == null ? '—' : `${koma(Math.round(v * 10) / 10)} ${satuan}`);
const rupiah = (v: number | null | undefined): string => (v == null ? '—' : fmtRpShort(v));
const skala5 = (v: number | null | undefined) => (v == null ? null : Math.round((v / 5) * 100));

/** Angka turunan keuangan yang dipakai Admin and Finance dan Owner. */
export function turunanKeuangan(F: FinanceResult | null, kapasitas: number, range: Range) {
  if (!F || F.pendapatanKotor <= 0 || kapasitas <= 0) {
    return { margin: null, opexPerKamar: null, diskonPct: null, revpar: null };
  }
  const hari = hariPeriode(range, new Date());
  const bulan = Math.max(1, hari / 30);
  const pendapatanSewa = Object.entries(F.incomeBy)
    .filter(([akun]) => /sewa/i.test(akun))
    .reduce((s, [, v]) => s + v, 0);
  return {
    margin: Math.round((F.labaBersih / F.pendapatanKotor) * 1000) / 10,
    opexPerKamar: Math.round(F.beban / kapasitas / bulan),
    diskonPct: Math.round((F.diskonTotal / F.pendapatanKotor) * 1000) / 10,
    revpar: revpar(pendapatanSewa, kapasitas, hari)
  };
}

type Turunan = ReturnType<typeof turunanKeuangan>;

/** "Total Diskon": satu kartu, dua satuan (rupiah di nilai, persen di keterangan). */
export function diskonSub(t: Turunan): string {
  return `${persen(t.diskonPct)} dari pendapatan · target ≤ 10 %`;
}

export interface AdminBase {
  aktif: number;
  kosong: number;
  jatuhTempo: number;
  kapasitas: number;
  pendapatan: number;
  diskon: number;
  labaBersih: number;
  sparkMasuk: number[];
  sparkTempo: number[];
  sparkPendapatan: number[];
  sparkDiskon: number[];
}

/** Admin dulu, lalu Finance. Tiap kartu ditandai kelompoknya (pita warna + pill). */
export function kartuAdmin(kpi: KpiData, t: Turunan, b: AdminBase): { admin: StatCardData[]; finance: StatCardData[] } {
  const a = kpi.admin;
  return {
    admin: [
      { grp: 'admin', label: 'Kontrak Aktif', value: String(b.aktif), sub: `dari ${b.kapasitas} kamar`, spark: b.sparkMasuk, bg: G.adminCyan },
      { grp: 'admin', label: 'Kamar Kosong', value: String(b.kosong), sub: 'Target 0 kamar', spark: b.sparkMasuk, bg: G.adminOlive, onDark: true },
      { grp: 'admin', label: 'Jatuh Tempo', value: String(b.jatuhTempo), sub: 'dalam 7 hari ke depan', spark: b.sparkTempo, bg: G.adminDarkG, onDark: true },
      { grp: 'admin', label: 'Dokumen Penghuni Lengkap', value: persen(a?.dokumenLengkap), sub: 'Target 100 %', progress: a?.dokumenLengkap, bg: G.adminGreen },
      { grp: 'admin', label: 'Respons Pengaduan', value: angka(a?.responsPengaduanJam, 'jam'), sub: 'Target 1 jam', bg: G.adminOlive, onDark: true },
      { grp: 'admin', label: 'Kepuasan Penghuni', value: a?.csat == null ? '—' : `${koma(a.csat)} / 5`, sub: 'Skala 1–5', progress: skala5(a?.csat), bg: G.adminDarkG, onDark: true }
    ],
    finance: [
      { grp: 'finance', label: 'Pendapatan', value: fmtRpShort(b.pendapatan), sub: 'Target Rp26 Jt / bulan', spark: b.sparkPendapatan, bg: G.adminGreen },
      { grp: 'finance', label: 'Total Diskon', value: fmtRpShort(b.diskon), sub: diskonSub(t), spark: b.sparkDiskon, bg: G.adminOlive, onDark: true },
      { grp: 'finance', label: 'Collection Rate', value: persen(a?.collectionRate), sub: 'Target 100 %', progress: a?.collectionRate, bg: G.adminCyan },
      { grp: 'finance', label: 'Margin Laba Bersih', value: persen(t.margin), sub: `Laba bersih ${rupiah(b.labaBersih)}`, bg: G.adminGreen },
      { grp: 'finance', label: 'OPEX per Kamar / Bulan', value: rupiah(t.opexPerKamar), sub: 'Target Rp300 rb', bg: G.adminOlive, onDark: true },
      { grp: 'finance', label: 'Tutup Buku (hari kerja)', value: a?.tutupBukuHariKerja == null ? '—' : String(a.tutupBukuHariKerja), sub: 'Target 1 hari kerja', bg: G.adminDarkG, onDark: true }
    ]
  };
}

/** Sales = tindak lanjut setelah leads: respons, survey, booking, retensi. */
export function kartuSales(
  kpi: KpiData,
  b: { survey: number; booking: number; cancelRate: number; avgTenure: number | null; okupansi: number; sparkSurvey: number[]; sparkBooking: number[] }
): { baris1: StatCardData[]; baris2: StatCardData[] } {
  const s = kpi.sales;
  return {
    baris1: [
      { label: 'Survey', value: String(b.survey), sub: 'Dari leads yang masuk', spark: b.sparkSurvey, bg: G.saleGold },
      { label: 'Konversi Leads → Survey', value: persen(s?.konversiLeadsSurvey), sub: 'Target 90 %', progress: s?.konversiLeadsSurvey, bg: G.salePeach },
      { label: 'Booking', value: String(b.booking), sub: 'Target 1 / bulan', spark: b.sparkBooking, bg: G.salePink },
      { label: 'Konversi Survey → Booking', value: persen(s?.konversiSurveyBooking), sub: 'Target 90 %', progress: s?.konversiSurveyBooking, bg: G.saleGold },
      { label: 'Cancellation Rate', value: `${b.cancelRate} %`, sub: 'Batas atas 20 %', progress: b.cancelRate, bg: G.saleRed }
    ],
    baris2: [
      { label: 'Respons Leads Pertama', value: angka(s?.responsLeadsMenit, 'menit'), sub: 'Target 15 menit', bg: G.saleRed },
      { label: 'Renewal Rate', value: persen(s?.renewalRate), sub: 'Target 100 %', progress: s?.renewalRate, bg: G.salePink },
      { label: 'Rata-Rata Lama Sewa', value: b.avgTenure == null ? '—' : `${koma(b.avgTenure)} bln`, sub: 'Target 3 bulan', progress: b.avgTenure == null ? null : (b.avgTenure / 3) * 100, bg: G.salePeach },
      { label: 'Vacancy Days', value: angka(s?.vacancyHari, 'hari'), sub: 'Target ≤ 30 hari', bg: G.saleGold },
      { label: 'Waiting List', value: String(s?.waitingList ?? 0), sub: 'Target 5 orang', bg: G.salePink },
      { label: 'Okupansi', value: `${b.okupansi} %`, sub: 'Target 100 %', progress: b.okupansi, bg: G.saleRed }
    ]
  };
}

/** Marketing = menciptakan leads. Berhenti di leads; survey ke atas milik Sales. */
export function kartuMarketing(kpi: KpiData, spark: number[]): { baris1: StatCardData[]; baris2: StatCardData[] } {
  const m = kpi.marketing;
  return {
    baris1: [
      { label: 'Leads Masuk', value: String(m?.leads ?? 0), sub: 'Target 10 leads / minggu', spark, bg: G.mkLeads },
      { label: 'Pencapaian Target Leads', value: persen(m?.pencapaianTarget), sub: 'Target 80 %', progress: m?.pencapaianTarget, bg: G.mkConv },
      { label: 'CPL', value: rupiah(m?.cpl), sub: 'Target Rp25 rb / lead', bg: G.mkLeads },
      { label: 'CAC', value: rupiah(m?.cac), sub: 'Target ≤ Rp50 rb', bg: G.mkCac }
    ],
    baris2: [
      { label: 'ROI Promosi', value: persen(m?.roi), sub: 'Target 100 %', bg: G.mkSurvey, onDark: true },
      { label: 'Engagement Rate', value: persen(m?.engagement), sub: 'Target 70 %', progress: m?.engagement, bg: G.mkUnit },
      { label: 'Konsistensi Posting', value: persen(m?.konsistensi), sub: 'Target 100 %', progress: m?.konsistensi, bg: G.mkCac }
    ]
  };
}

/** Operasional hanya Resolution Time (WO masuk sampai selesai); respons pelaporan milik Admin/Sales. */
export function kartuOps(
  kpi: KpiData,
  b: { resolusiHari: number | null; sparkResolusi: number[] }
): { sla: StatCardData; baris2: StatCardData[] } {
  const o = kpi.ops;
  return {
    sla: { label: 'Kepatuhan SLA Tiket', value: persen(o?.slaPatuh), sub: 'Target 100 %', progress: o?.slaPatuh, bg: G.opTeal },
    baris2: [
      { label: 'Resolution Time', value: angka(b.resolusiHari, 'hari'), sub: 'Target 1 hari', spark: b.sparkResolusi, progress: b.resolusiHari == null ? null : Math.min(100, (1 / Math.max(b.resolusiHari, 0.1)) * 100), bg: G.opRed, onDark: true },
      { label: 'Kepatuhan Jadwal Preventif', value: persen(o?.kepatuhanPreventif), sub: 'Target 100 %', progress: o?.kepatuhanPreventif, bg: G.opTeal2 },
      { label: 'Kepatuhan Inspeksi Harian', value: persen(o?.kepatuhanInspeksi), sub: 'Target 100 %', progress: o?.kepatuhanInspeksi, bg: G.opYellow },
      { label: 'Waktu Prepare Kamar', value: angka(o?.kamarSiapHari, 'hari'), sub: 'Target 1 hari', progress: o?.kamarSiapHari == null ? null : Math.min(100, (1 / Math.max(o.kamarSiapHari, 0.1)) * 100), bg: G.opGreen },
      { label: 'Tiket Berulang', value: String(o?.tiketBerulang ?? 0), sub: 'Batas atas 2 kasus', bg: G.opOrange, onDark: true },
      { label: 'Biaya Perbaikan / Kamar', value: rupiah(o?.biayaPerKamar), sub: 'Target Rp150 rb', bg: G.opAmber }
    ]
  };
}

export function kartuOwner(kpi: KpiData, t: Turunan, laba: number): StatCardData[] {
  return [
    { label: 'RevPAR', value: rupiah(t.revpar), sub: 'Pendapatan sewa per kamar per hari', bg: G.ownPrimary, onDark: true },
    { label: 'Margin Laba Bersih', value: persen(t.margin), sub: 'Laba ÷ pendapatan', bg: G.ownRose, onDark: true },
    { label: 'OPEX per Kamar / Bulan', value: rupiah(t.opexPerKamar), sub: 'Target Rp300 rb', bg: G.ownGray, onDark: true },
    { label: 'Kepuasan Penghuni', value: kpi.admin?.csat == null ? '—' : `${koma(kpi.admin.csat)} / 5`, sub: 'Skala 1–5', progress: skala5(kpi.admin?.csat), bg: G.ownRose, onDark: true }
  ];
}
