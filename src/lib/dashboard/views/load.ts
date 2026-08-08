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
import { readInventory, isInventoryConfigured, type InventoryData } from '../inventory';
import { computeFinance, findTransaksiGrid, type FinanceResult } from './finance';
import { periodRange, DEFAULT_PERIOD_FALLBACK } from './period';
import type { DashboardData, PaymentRaw, TransaksiRow } from './types';
import { turso } from '../../core/turso';

export interface DashboardPageData {
  data: DashboardData;
  finance: FinanceResult | null;
  txGrid: SheetGrid | null;
  range: { from: Date | null; to: Date | null };
  configured: boolean;
  /** Hanya terisi bila halaman memintanya (view "stok"); null = tak tersedia. */
  inventory: InventoryData | null;
}

export async function loadDashboardData(
  role: string,
  period: string,
  from?: string,
  to?: string,
  opts?: { withInventory?: boolean }
): Promise<DashboardPageData> {
  const range = periodRange(period || DEFAULT_PERIOD_FALLBACK, from, to);

  // Stok inventory berasal dari DB app lain; hanya dibaca saat halaman stok
  // dibuka supaya halaman lain tidak menanggung query tambahan.
  let inventory: InventoryData | null = null;
  if (opts?.withInventory && isInventoryConfigured()) {
    try {
      inventory = await readInventory();
    } catch (e) {
      console.error('[dashboard] gagal baca DB inventory:', e);
    }
  }

  // Muat payment + transaksi dari Turso secara paralel — tidak bergantung Sheets.
  const [tursoPayments, transaksi] = await Promise.all([
    loadTursoPayments(),
    loadTransaksi()
  ]);

  if (!isConfigured()) {
    return {
      data: hydrateDashboard({}, { tursoPayments, transaksi }),
      finance: null,
      txGrid: null,
      range,
      configured: false,
      inventory
    };
  }

  const all = await readComputedSheets();
  const sheets = filterSheetsForRole(all, role); // RLS — lihat catatan di header
  const data = hydrateDashboard(sheets, { tursoPayments, transaksi });
  const txGrid = findTransaksiGrid(sheets);
  const finance = computeFinance(txGrid, range);

  return { data, finance, txGrid, range, configured: true, inventory };
}

/** Baca semua payment dari Turso, dikonversi ke format PaymentRaw untuk computeTempo. */
async function loadTursoPayments(): Promise<PaymentRaw[]> {
  try {
    const db = turso();
    const rs = await db.execute(
      `SELECT id_penghuni, id_payment, periode_awal, periode_akhir, amount, payment_date, status, notes
       FROM payment ORDER BY payment_date DESC`
    );
    return rs.rows.map((r: any) => ({
      idP: String(r.id_penghuni ?? ''),
      inv: String(r.id_payment ?? ''),
      awal: String(r.periode_awal ?? ''),
      akhir: String(r.periode_akhir ?? ''),
      amount: String(r.amount ?? ''),
      tgl: String(r.payment_date ?? ''),
      metode: '',
      status: String(r.status ?? ''),
      notes: String(r.notes ?? '')
    }));
  } catch (e) {
    console.error('[dashboard] gagal baca Turso payment:', e);
    return [];
  }
}

/** Muat transaksi non-sewa: gabungan income_non_rent + pengeluaran dari jurnal_transaksi. */
async function loadTransaksi(): Promise<TransaksiRow[]> {
  try {
    const db = turso();
    // Pastikan tabel income_non_rent ada
    await db.execute(
      `CREATE TABLE IF NOT EXISTS income_non_rent (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal TEXT NOT NULL,
        nama_transaksi TEXT NOT NULL,
        jumlah REAL NOT NULL DEFAULT 0,
        keterangan TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      )`
    );

    const [incRows, expRows] = await Promise.all([
      db.execute(`SELECT tanggal, nama_transaksi, jumlah, keterangan FROM income_non_rent ORDER BY tanggal DESC`),
      db.execute(`SELECT tanggal, keterangan, nominal FROM jurnal_transaksi ORDER BY tanggal DESC LIMIT 500`)
    ]);

    const income: TransaksiRow[] = incRows.rows.map((r: any) => ({
      tanggal: String(r.tanggal ?? ''),
      namaTx: String(r.nama_transaksi ?? ''),
      jenisTx: 'Pendapatan',
      jumlah: `Rp${Math.round(Number(r.jumlah) || 0).toLocaleString('id-ID')}`,
      keterangan: String(r.keterangan ?? '')
    }));

    const expense: TransaksiRow[] = expRows.rows.map((r: any) => ({
      tanggal: String(r.tanggal ?? ''),
      namaTx: String(r.keterangan ?? ''),
      jenisTx: 'Pengeluaran',
      jumlah: `Rp${Math.round(Number(r.nominal) || 0).toLocaleString('id-ID')}`,
      keterangan: String(r.keterangan ?? '')
    }));

    return [...income, ...expense].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  } catch (e) {
    console.error('[dashboard] gagal baca transaksi:', e);
    return [];
  }
}
