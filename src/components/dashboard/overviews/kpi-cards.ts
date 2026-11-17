/* Pembentuk kartu KPI SOW per halaman. Murni: terima angka, kembalikan StatCardData.
   Tiap kartu membawa `sub` (target atau satuan kedua) supaya ruangnya terisi informasi, bukan kosong. */

import type { StatCardData } from '@/components/ui/StatCard';
import { G } from '@/config/dashboard-palette';
import { fmtRpShort, type FinanceResult } from '@/lib/dashboard/views/finance';
import { hariPeriode, revpar, type Range } from '@/lib/dashboard/kpi-calc';
import type { KpiData } from '@/lib/dashboard/kpi';
import { persenBatas, persenCapai, teksTarget, type TargetMap } from '@/lib/dashboard/targets';

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
export function diskonSub(t: Turunan, T: TargetMap): string {
  return `${persen(t.diskonPct)} dari pendapatan · ${teksTarget(T, 'diskon_pct').toLowerCase()}`;
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
  /** Panjang periode aktif (hari), untuk menskalakan target bulanan. */
  hariPeriode: number;
}

/** Admin dulu, lalu Finance. Tiap kartu ditandai kelompoknya (pita warna + pill). */
export function kartuAdmin(kpi: KpiData, t: Turunan, b: AdminBase, T: TargetMap): { admin: StatCardData[]; finance: StatCardData[] } {
  const a = kpi.admin;
  const bulanPeriode = Math.max(1, b.hariPeriode / 30);
  return {
    admin: [
      { grp: 'admin', label: 'Kontrak Aktif', value: String(b.aktif), sub: `dari ${b.kapasitas} kamar`, spark: b.sparkMasuk, bg: G.adminCyan },
      { grp: 'admin', label: 'Kamar Kosong', value: String(b.kosong), sub: teksTarget(T, 'kamar_kosong'), spark: b.sparkMasuk, bg: G.adminOlive, onDark: true },
      { grp: 'admin', label: 'Jatuh Tempo', value: String(b.jatuhTempo), sub: 'dalam 7 hari ke depan', spark: b.sparkTempo, bg: G.adminDarkG, onDark: true },
      { grp: 'admin', label: 'Dokumen Penghuni Lengkap', value: persen(a?.dokumenLengkap), sub: teksTarget(T, 'dokumen_lengkap'), progress: persenCapai(a?.dokumenLengkap, T.dokumen_lengkap), bg: G.adminGreen },
      { grp: 'admin', label: 'Respons Pengaduan', value: angka(a?.responsPengaduanJam, 'jam'), sub: teksTarget(T, 'respons_pengaduan'), progress: persenBatas(a?.responsPengaduanJam, T.respons_pengaduan), bg: G.adminOlive, onDark: true },
      { grp: 'admin', label: 'Kepuasan Penghuni', value: a?.csat == null ? '—' : `${koma(a.csat)} / 5`, sub: 'Skala 1–5', progress: skala5(a?.csat), bg: G.adminDarkG, onDark: true }
    ],
    finance: [
      { grp: 'finance', label: 'Pendapatan', value: fmtRpShort(b.pendapatan), sub: teksTarget(T, 'pendapatan_bulan') + ' / bulan', progress: persenCapai(b.pendapatan, T.pendapatan_bulan * bulanPeriode), spark: b.sparkPendapatan, bg: G.adminGreen },
      { grp: 'finance', label: 'Total Diskon', value: fmtRpShort(b.diskon), sub: diskonSub(t, T), spark: b.sparkDiskon, bg: G.adminOlive, onDark: true },
      { grp: 'finance', label: 'Collection Rate', value: persen(a?.collectionRate), sub: teksTarget(T, 'collection_rate'), progress: persenCapai(a?.collectionRate, T.collection_rate), bg: G.adminCyan },
      { grp: 'finance', label: 'Margin Laba Bersih', value: persen(t.margin), sub: `Laba bersih ${rupiah(b.labaBersih)}`, bg: G.adminGreen },
      { grp: 'finance', label: 'OPEX per Kamar / Bulan', value: rupiah(t.opexPerKamar), sub: teksTarget(T, 'opex_per_kamar'), progress: persenBatas(t.opexPerKamar, T.opex_per_kamar), bg: G.adminOlive, onDark: true },
      { grp: 'finance', label: 'Tutup Buku (hari kerja)', value: a?.tutupBukuHariKerja == null ? '—' : String(a.tutupBukuHariKerja), sub: teksTarget(T, 'tutup_buku'), progress: persenBatas(a?.tutupBukuHariKerja, T.tutup_buku), bg: G.adminDarkG, onDark: true }
    ]
  };
}

/** Sales = tindak lanjut setelah leads: respons, survey, booking, retensi. */
export function kartuSales(
  kpi: KpiData,
  b: { survey: number; booking: number; cancelRate: number; avgTenure: number | null; okupansi: number; sparkSurvey: number[]; sparkBooking: number[] },
  T: TargetMap
): { baris1: StatCardData[]; baris2: StatCardData[] } {
  const s = kpi.sales;
  return {
    baris1: [
      { label: 'Survey', value: String(b.survey), sub: 'Dari leads yang masuk', spark: b.sparkSurvey, bg: G.saleGold },
      { label: 'Konversi Leads → Survey', value: persen(s?.konversiLeadsSurvey), sub: teksTarget(T, 'konversi_leads_survey'), progress: persenCapai(s?.konversiLeadsSurvey, T.konversi_leads_survey), bg: G.salePeach },
      { label: 'Booking', value: String(b.booking), sub: teksTarget(T, 'booking_bulan'), spark: b.sparkBooking, bg: G.salePink },
      { label: 'Konversi Survey → Booking', value: persen(s?.konversiSurveyBooking), sub: teksTarget(T, 'konversi_survey_booking'), progress: persenCapai(s?.konversiSurveyBooking, T.konversi_survey_booking), bg: G.saleGold },
      { label: 'Cancellation Rate', value: `${b.cancelRate} %`, sub: teksTarget(T, 'cancel_max'), progress: persenBatas(b.cancelRate, T.cancel_max), bg: G.saleRed }
    ],
    baris2: [
      { label: 'Respons Leads Pertama', value: angka(s?.responsLeadsMenit, 'menit'), sub: teksTarget(T, 'respons_leads'), progress: persenBatas(s?.responsLeadsMenit, T.respons_leads), bg: G.saleRed },
      { label: 'Renewal Rate', value: persen(s?.renewalRate), sub: teksTarget(T, 'renewal_rate'), progress: persenCapai(s?.renewalRate, T.renewal_rate), bg: G.salePink },
      { label: 'Rata-Rata Lama Sewa', value: b.avgTenure == null ? '—' : `${koma(b.avgTenure)} bln`, sub: teksTarget(T, 'lama_sewa'), progress: persenCapai(b.avgTenure, T.lama_sewa), bg: G.salePeach },
      { label: 'Vacancy Days', value: angka(s?.vacancyHari, 'hari'), sub: teksTarget(T, 'vacancy_hari'), progress: persenBatas(s?.vacancyHari, T.vacancy_hari), bg: G.saleGold },
      { label: 'Waiting List', value: String(s?.waitingList ?? 0), sub: teksTarget(T, 'waiting_list'), progress: persenCapai(s?.waitingList ?? 0, T.waiting_list), bg: G.salePink },
      { label: 'Okupansi', value: `${b.okupansi} %`, sub: teksTarget(T, 'okupansi'), progress: persenCapai(b.okupansi, T.okupansi), bg: G.saleRed }
    ]
  };
}

/** Marketing = menciptakan leads. Berhenti di leads; survey ke atas milik Sales. */
export function kartuMarketing(kpi: KpiData, spark: number[], T: TargetMap, minggu: number): { baris1: StatCardData[]; baris2: StatCardData[] } {
  const m = kpi.marketing;
  return {
    baris1: [
      { label: 'Leads Masuk', value: String(m?.leads ?? 0), sub: teksTarget(T, 'leads_minggu'), progress: persenCapai(m?.leads ?? 0, T.leads_minggu * minggu), spark, bg: G.mkLeads },
      { label: 'Pencapaian Target Leads', value: persen(m?.pencapaianTarget), sub: teksTarget(T, 'pencapaian_leads'), progress: persenCapai(m?.pencapaianTarget, T.pencapaian_leads), bg: G.mkConv },
      { label: 'CPL', value: rupiah(m?.cpl), sub: teksTarget(T, 'cpl'), progress: persenBatas(m?.cpl, T.cpl), bg: G.mkLeads },
      { label: 'CAC', value: rupiah(m?.cac), sub: teksTarget(T, 'cac'), progress: persenBatas(m?.cac, T.cac), bg: G.mkCac }
    ],
    baris2: [
      { label: 'ROI Promosi', value: persen(m?.roi), sub: teksTarget(T, 'roi'), progress: persenCapai(m?.roi, T.roi), bg: G.mkSurvey, onDark: true },
      { label: 'Engagement Rate', value: persen(m?.engagement), sub: teksTarget(T, 'engagement'), progress: persenCapai(m?.engagement, T.engagement), bg: G.mkUnit },
      { label: 'Konsistensi Posting', value: persen(m?.konsistensi), sub: teksTarget(T, 'konsistensi'), progress: persenCapai(m?.konsistensi, T.konsistensi), bg: G.mkCac }
    ]
  };
}

/** Operasional hanya Resolution Time (WO masuk sampai selesai); respons pelaporan milik Admin/Sales. */
export function kartuOps(
  kpi: KpiData,
  b: { resolusiHari: number | null; sparkResolusi: number[] },
  T: TargetMap
): { sla: StatCardData; baris2: StatCardData[] } {
  const o = kpi.ops;
  return {
    sla: { label: 'Kepatuhan SLA Tiket', value: persen(o?.slaPatuh), sub: teksTarget(T, 'sla_patuh'), progress: persenCapai(o?.slaPatuh, T.sla_patuh), bg: G.opTeal },
    baris2: [
      { label: 'Resolution Time', value: angka(b.resolusiHari, 'hari'), sub: teksTarget(T, 'resolusi_hari'), spark: b.sparkResolusi, progress: persenBatas(b.resolusiHari, T.resolusi_hari), bg: G.opRed, onDark: true },
      { label: 'Kepatuhan Jadwal Preventif', value: persen(o?.kepatuhanPreventif), sub: teksTarget(T, 'jadwal_preventif'), progress: persenCapai(o?.kepatuhanPreventif, T.jadwal_preventif), bg: G.opTeal2 },
      { label: 'Kepatuhan Inspeksi Harian', value: persen(o?.kepatuhanInspeksi), sub: teksTarget(T, 'inspeksi'), progress: persenCapai(o?.kepatuhanInspeksi, T.inspeksi), bg: G.opYellow },
      { label: 'Waktu Prepare Kamar', value: angka(o?.kamarSiapHari, 'hari'), sub: teksTarget(T, 'prepare_kamar'), progress: persenBatas(o?.kamarSiapHari, T.prepare_kamar), bg: G.opGreen },
      { label: 'Tiket Berulang', value: String(o?.tiketBerulang ?? 0), sub: teksTarget(T, 'tiket_berulang'), progress: persenBatas(o?.tiketBerulang ?? 0, T.tiket_berulang), bg: G.opOrange, onDark: true },
      { label: 'Biaya Perbaikan / Kamar', value: rupiah(o?.biayaPerKamar), sub: teksTarget(T, 'biaya_per_kamar'), progress: persenBatas(o?.biayaPerKamar, T.biaya_per_kamar), bg: G.opAmber }
    ]
  };
}

export function kartuOwner(kpi: KpiData, t: Turunan, laba: number, T: TargetMap): StatCardData[] {
  return [
    { label: 'RevPAR', value: rupiah(t.revpar), sub: 'Pendapatan sewa per kamar per hari', bg: G.ownPrimary, onDark: true },
    { label: 'Margin Laba Bersih', value: persen(t.margin), sub: 'Laba ÷ pendapatan', bg: G.ownRose, onDark: true },
    { label: 'OPEX per Kamar / Bulan', value: rupiah(t.opexPerKamar), sub: teksTarget(T, 'opex_per_kamar'), progress: persenBatas(t.opexPerKamar, T.opex_per_kamar), bg: G.ownGray, onDark: true },
    { label: 'Kepuasan Penghuni', value: kpi.admin?.csat == null ? '—' : `${koma(kpi.admin.csat)} / 5`, sub: 'Skala 1–5', progress: skala5(kpi.admin?.csat), bg: G.ownRose, onDark: true }
  ];
}
