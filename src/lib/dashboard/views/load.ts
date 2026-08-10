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
import type { DashboardData, PaymentRaw, TransaksiRow, Tempo, TempoEntry, WaitingListRow } from './types';
import { turso } from '../../core/turso';
import { startOfDay, parseDate } from '../format';

export interface DashboardPageData {
  data: DashboardData;
  finance: FinanceResult | null;
  txGrid: SheetGrid | null;
  range: { from: Date | null; to: Date | null };
  configured: boolean;
  /** Hanya terisi bila halaman memintanya (view "stok"); null = tak tersedia. */
  inventory: InventoryData | null;
  waitingList: WaitingListRow[];
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

  // Muat payment + transaksi + tempo + waiting list dari Turso secara paralel.
  const [tursoPayments, transaksi, tursoTempo, waitingList] = await Promise.all([
    loadTursoPayments(),
    loadTransaksi(),
    loadTursoTempo(),
    loadWaitingList()
  ]);

  if (!isConfigured()) {
    return {
      data: hydrateDashboard({}, { tursoPayments, transaksi, tursoTempo }),
      finance: null,
      txGrid: null,
      range,
      configured: false,
      inventory,
      waitingList
    };
  }

  const all = await readComputedSheets();
  const sheets = filterSheetsForRole(all, role); // RLS — lihat catatan di header
  const data = hydrateDashboard(sheets, { tursoPayments, transaksi, tursoTempo });
  const txGrid = findTransaksiGrid(sheets);
  const finance = computeFinance(txGrid, range);

  return { data, finance, txGrid, range, configured: true, inventory, waitingList };
}

/** Baca semua invoice dari Turso (invoice_sewa), termasuk yang belum dibayar. */
async function loadTursoPayments(): Promise<PaymentRaw[]> {
  try {
    const db = turso();
    const rs = await db.execute(
      `SELECT id_penghuni, no_inv, periode_awal, periode_akhir, grand_total,
              tanggal_pembayaran, nama,
              CASE
                WHEN tanggal_pembayaran IS NOT NULL THEN 'Paid'
                WHEN periode_akhir < date('now') THEN 'Overdue'
                WHEN periode_akhir <= date('now', '+7 days') THEN 'Jatuh Tempo'
                ELSE 'Pending'
              END AS status_computed
       FROM invoice_sewa
       WHERE id_penghuni IS NOT NULL
       ORDER BY COALESCE(tanggal_pembayaran, periode_akhir) DESC, id DESC`
    );
    return rs.rows.map((r: any) => ({
      idP: String(r.id_penghuni ?? ''),
      inv: String(r.no_inv ?? ''),
      awal: String(r.periode_awal ?? ''),
      akhir: String(r.periode_akhir ?? ''),
      amount: String(r.grand_total ?? 0),
      tgl: String(r.tanggal_pembayaran ?? ''),
      metode: '',
      status: String(r.status_computed ?? 'Pending'),
      notes: '',
      nama: String(r.nama ?? '')
    }));
  } catch (e) {
    console.error('[dashboard] gagal baca invoice_sewa:', e);
    return [];
  }
}

/**
 * Hitung jatuh tempo & tunggakan langsung dari Turso (active_tenant JOIN payment).
 * Lebih akurat dari jalur sheets karena occupancy_history bisa kosong untuk penghuni lama.
 * Return null jika active_tenant kosong atau tidak ada data pembayaran sama sekali.
 */
async function loadTursoTempo(): Promise<Tempo | null> {
  try {
    const db = turso();
    const rs = await db.execute(
      `SELECT at.nama_lengkap, at.no_hp, at.id_penghuni,
              MAX(inv.periode_akhir) AS max_akhir
       FROM active_tenant at
       LEFT JOIN invoice_sewa inv ON inv.id_penghuni = at.id_penghuni
                                 AND inv.periode_akhir IS NOT NULL
       GROUP BY at.id_penghuni, at.nama_lengkap, at.no_hp`
    );
    if (!rs.rows.length) return null;

    const today = startOfDay(new Date());
    const DAY = 86400000;
    let tunggakan = 0;
    let jatuhTempo = 0;
    const list: TempoEntry[] = [];

    for (const r of rs.rows) {
      const d = r.max_akhir ? parseDate(String(r.max_akhir)) : null;
      const s = d ? Math.round((d.getTime() - today.getTime()) / DAY) : null;
      if (s !== null) {
        if (s <= 0) tunggakan++;
        else if (s <= 7) jatuhTempo++;
        if (s <= 7) {
          list.push({
            name: String(r.nama_lengkap ?? ''),
            nama: String(r.nama_lengkap ?? ''),
            wa: String(r.no_hp ?? ''),
            tempo: String(r.max_akhir ?? '—'),
            sisa: s < 0 ? 'Telat ' + (-s) + ' hr' : s === 0 ? 'Hari ini' : s + ' hr lagi',
            _s: s,
            idPenghuni: String(r.id_penghuni ?? '')
          });
        }
      }
    }
    list.sort((a, b) => a._s - b._s);
    if (!tunggakan && !jatuhTempo && !list.length) return null;
    return { list, tunggakan, jatuhTempo };
  } catch (e) {
    console.error('[dashboard] gagal baca tempo dari Turso:', e);
    return null;
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
      db.execute(`SELECT tanggal, keterangan, nominal FROM jurnal_transaksi WHERE keterangan NOT LIKE 'Pengakuan%' ORDER BY tanggal DESC LIMIT 500`)
    ]);

    const income: TransaksiRow[] = incRows.rows.map((r: any) => ({
      tanggal: String(r.tanggal ?? ''),
      namaTx: String(r.nama_transaksi ?? ''),
      jenisTx: 'Pendapatan',
      jumlah: `Rp${Math.round(Number(r.jumlah) || 0).toLocaleString('id-ID')}`,
      keterangan: String(r.keterangan ?? '')
    }));

    const expense: TransaksiRow[] = expRows.rows.map((r: any) => {
      const ket = String(r.keterangan ?? '');
      return {
        tanggal: String(r.tanggal ?? ''),
        namaTx: ket,
        jenisTx: /^(terima sewa|diskon sewa|pelunasan)/i.test(ket) ? 'Pendapatan' : 'Pengeluaran',
        jumlah: `Rp${Math.round(Number(r.nominal) || 0).toLocaleString('id-ID')}`,
        keterangan: ket
      };
    });

    return [...income, ...expense].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  } catch (e) {
    console.error('[dashboard] gagal baca transaksi:', e);
    return [];
  }
}

/** Muat semua data waiting_list dari Turso. */
async function loadWaitingList(): Promise<WaitingListRow[]> {
  try {
    const db = turso();
    const rs = await db.execute(
      `SELECT id, nama, nomor_whatsapp, link_whatsapp, tipe, rencana_tanggal, budget_max, status, keterangan
       FROM waiting_list ORDER BY id DESC`
    );
    return rs.rows.map((r: any) => ({
      id: String(r.id ?? ''),
      name: String(r.nama ?? ''),
      wa: String(r.nomor_whatsapp ?? ''),
      tipe: String(r.tipe ?? '—'),
      rencanaTanggal: String(r.rencana_tanggal ?? '—'),
      budgetMax: r.budget_max != null ? `Rp${Math.round(Number(r.budget_max)).toLocaleString('id-ID')}` : '—',
      status: String(r.status ?? ''),
      keterangan: String(r.keterangan ?? ''),
      aksi: String(r.link_whatsapp ?? '')
    }));
  } catch (e) {
    console.error('[dashboard] gagal baca waiting_list:', e);
    return [];
  }
}
