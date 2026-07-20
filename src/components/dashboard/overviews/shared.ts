/* Kontrak bersama komponen overview (Fase 4 langkah 4).
   Semua overview presentasional murni: menerima data hasil hidrasi + hasil
   perhitungan keuangan, tanpa fetch sendiri (§2.2 pemisahan concern). */

import type { DashboardData } from '@/lib/dashboard/views/types';
import type { FinanceResult } from '@/lib/dashboard/views/finance';
import type { SheetGrid } from '@/lib/dashboard/source';

export interface OverviewProps {
  data: DashboardData;
  /** Hasil computeFinance utk periode aktif; null = tampilkan empty-state. */
  finance: FinanceResult | null;
  /** Grid tab transaksi mentah — sebagian overview memerlukannya lagi. */
  txGrid: SheetGrid | null;
  period: string;
  from?: string;
  to?: string;
  /** Rentang periode yang sudah dihitung, dipakai seriesByDate. */
  range: { from: Date | null; to: Date | null };
}
