/* =========================================================================
   Pemuat data untuk halaman Dashboard (Server Component).

   Menggabungkan: baca Turso (source) → RLS per role (rls) → hidrasi (hydrate)
   → hitung keuangan periode (finance). Dipanggil dari page.tsx.

   RLS DITERAPKAN DI SINI, bukan hanya di Route Handler: halaman dashboard
   membaca data lewat jalur server langsung (tanpa lewat /api/dashboard/sheets),
   jadi filter role harus ikut di jalur ini juga — kalau tidak, marketing bisa
   melihat tab keuangan lewat halaman meski API-nya menolak.
   ========================================================================= */

import { readComputedSheets, isConfigured, type SheetGrid } from '../source';
import { filterSheetsForRole } from '../rls';
import { hydrateDashboard } from './hydrate';
import { computeFinance, findTransaksiGrid, type FinanceResult } from './finance';
import { periodRange, DEFAULT_PERIOD_FALLBACK } from './period';
import type { DashboardData } from './types';

export interface DashboardPageData {
  data: DashboardData;
  finance: FinanceResult | null;
  txGrid: SheetGrid | null;
  range: { from: Date | null; to: Date | null };
  configured: boolean;
}

export async function loadDashboardData(
  role: string,
  period: string,
  from?: string,
  to?: string
): Promise<DashboardPageData> {
  const range = periodRange(period || DEFAULT_PERIOD_FALLBACK, from, to);

  if (!isConfigured()) {
    return {
      data: hydrateDashboard({}),
      finance: null,
      txGrid: null,
      range,
      configured: false
    };
  }

  const all = await readComputedSheets();
  const sheets = filterSheetsForRole(all, role); // RLS — lihat catatan di header
  const data = hydrateDashboard(sheets);
  const txGrid = findTransaksiGrid(sheets);
  const finance = computeFinance(txGrid, range);

  return { data, finance, txGrid, range, configured: true };
}
