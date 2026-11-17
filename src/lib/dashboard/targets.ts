/* =========================================================================
   Target KPI: daftar definisi + nilai bawaan (dari SOW-DRAFT.md).
   Nilai yang berlaku = tabel `kpi_target` bila ada barisnya, kalau tidak nilai bawaan.
   Modul murni (tanpa DB) supaya bisa dipakai server dan client.
   ========================================================================= */

import { fmtRpShort } from '@/lib/dashboard/views/finance';

export type DivisiTarget = 'admin_finance' | 'sales' | 'marketing' | 'operasional';

export interface TargetDef {
  kunci: string;
  divisi: DivisiTarget;
  label: string;
  /** '%' dan 'Rp' diformat khusus; selain itu dicetak apa adanya setelah angka. */
  satuan: string;
  nilaiBawaan: number;
  /** min = makin tinggi makin baik (target dicapai bila >=); max = makin rendah makin baik (batas atas). */
  arah: 'min' | 'max';
}

const d = (divisi: DivisiTarget, kunci: string, label: string, satuan: string, nilaiBawaan: number, arah: 'min' | 'max' = 'min'): TargetDef => ({
  kunci, divisi, label, satuan, nilaiBawaan, arah
});

export const DEFINISI_TARGET: TargetDef[] = [
  d('admin_finance', 'pendapatan_bulan', 'Pendapatan kotor per bulan', 'Rp', 26_000_000),
  d('admin_finance', 'diskon_pct', 'Total diskon (dari pendapatan)', '%', 10, 'max'),
  d('admin_finance', 'collection_rate', 'Collection rate', '%', 100),
  d('admin_finance', 'opex_per_kamar', 'OPEX per kamar per bulan', 'Rp', 300_000, 'max'),
  d('admin_finance', 'tutup_buku', 'Waktu tutup buku', 'hari kerja', 1, 'max'),
  d('admin_finance', 'dokumen_lengkap', 'Kelengkapan dokumen penghuni', '%', 100),
  d('admin_finance', 'respons_pengaduan', 'Respons pengaduan', 'jam', 1, 'max'),
  d('admin_finance', 'kamar_kosong', 'Kamar kosong', 'kamar', 0, 'max'),

  d('sales', 'konversi_leads_survey', 'Konversi leads → survey', '%', 90),
  d('sales', 'konversi_survey_booking', 'Konversi survey → booking', '%', 90),
  d('sales', 'booking_bulan', 'Booking baru per bulan', 'booking', 1),
  d('sales', 'cancel_max', 'Cancellation rate', '%', 20, 'max'),
  d('sales', 'respons_leads', 'Respons leads pertama', 'menit', 15, 'max'),
  d('sales', 'renewal_rate', 'Renewal rate', '%', 100),
  d('sales', 'lama_sewa', 'Rata-rata lama sewa', 'bulan', 3),
  d('sales', 'vacancy_hari', 'Vacancy days', 'hari', 30, 'max'),
  d('sales', 'waiting_list', 'Ukuran waiting list', 'orang', 5),
  d('sales', 'okupansi', 'Okupansi', '%', 100),

  d('marketing', 'leads_minggu', 'Leads masuk', 'leads/minggu', 10),
  d('marketing', 'pencapaian_leads', 'Pencapaian target leads', '%', 80),
  d('marketing', 'cpl', 'CPL (biaya per lead)', 'Rp', 25_000, 'max'),
  d('marketing', 'cac', 'CAC', 'Rp', 50_000, 'max'),
  d('marketing', 'roi', 'ROI promosi', '%', 100),
  d('marketing', 'engagement', 'Engagement rate konten', '%', 70),
  d('marketing', 'konsistensi', 'Konsistensi posting', '%', 100),

  d('operasional', 'sla_patuh', 'Kepatuhan SLA tiket', '%', 100),
  d('operasional', 'resolusi_hari', 'Resolution time', 'hari', 1, 'max'),
  d('operasional', 'jadwal_preventif', 'Kepatuhan jadwal preventif', '%', 100),
  d('operasional', 'inspeksi', 'Kepatuhan inspeksi harian', '%', 100),
  d('operasional', 'prepare_kamar', 'Waktu prepare kamar', 'hari', 1, 'max'),
  d('operasional', 'tiket_berulang', 'Tiket berulang', 'kasus', 2, 'max'),
  d('operasional', 'biaya_per_kamar', 'Biaya perbaikan per kamar', 'Rp', 150_000, 'max')
];

export const DIVISI_LABEL: Record<DivisiTarget, string> = {
  admin_finance: 'Admin and Finance',
  sales: 'Sales',
  marketing: 'Marketing',
  operasional: 'Operasional'
};

export type TargetMap = Record<string, number>;

export const targetBawaan = (): TargetMap => Object.fromEntries(DEFINISI_TARGET.map((t) => [t.kunci, t.nilaiBawaan]));

const koma = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** Teks target untuk keterangan kartu, mis. "Target 100 %", "Target ≤ 1 jam", "Target ≤ Rp25 rb". */
export function teksTarget(T: TargetMap, kunci: string): string {
  const def = DEFINISI_TARGET.find((x) => x.kunci === kunci);
  if (!def) return '';
  const n = T[kunci] ?? def.nilaiBawaan;
  const awal = def.arah === 'max' ? 'Target ≤ ' : 'Target ';
  if (def.satuan === 'Rp') return `${awal}Rp${fmtRpShort(n)}`;
  if (def.satuan === '%') return `${awal}${koma(n)} %`;
  return `${awal}${koma(n)} ${def.satuan}`;
}

/** Isi bar pencapaian 0-100 untuk KPI "makin tinggi makin baik"; null bila nilai atau target kosong. */
export function persenCapai(nilai: number | null | undefined, target: number): number | null {
  if (nilai == null || !(target > 0)) return null;
  return Math.max(0, Math.min(100, (nilai / target) * 100));
}

/** Isi bar untuk KPI "makin rendah makin baik" (batas atas): penuh bila nilai <= target. */
export function persenBatas(nilai: number | null | undefined, target: number): number | null {
  if (nilai == null) return null;
  if (nilai <= target) return 100;
  return Math.max(0, Math.min(100, (target / nilai) * 100));
}

/** Owner mengatur semua target; kepala divisi (akun bertanda) hanya divisinya sendiri; staf dan Pengawas hanya melihat. */
export const bolehUbahTarget = (role: string, divisi: DivisiTarget, kepala: boolean): boolean =>
  role === 'owner' || (kepala && role === divisi);

export const divisiTerlihat = (role: string): DivisiTarget[] => {
  const semua = Object.keys(DIVISI_LABEL) as DivisiTarget[];
  return role === 'owner' || role === 'pengawas' ? semua : semua.filter((x) => x === role);
};
