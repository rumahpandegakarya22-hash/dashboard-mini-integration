/* =========================================================================
   Pembentuk baris halaman data Dashboard — PORT dari fungsi pembentuk data
   di public/app.js (Fase 4 langkah 4, bagian 3).

   SEMUA fungsi di sini murni: menerima data hasil hidrasi, mengembalikan baris
   tabel. Tidak ada state global, tidak ada DOM.

   PENYIMPANGAN YANG DISENGAJA (atas instruksi user, lihat docs/MIGRASI.md §4.7):
   cabang FALLBACK SINTETIS tidak ikut di-port. Di app.js, `dokumenRows()`,
   `tiketRows()`, `logInspeksiRows()`, `logPerbaikanRows()` membangkitkan baris
   karangan ("Kontrak Sewa", "Servis AC", "Kamar 09") saat sumber kosong —
   tidak bisa dibedakan dari data nyata. Di sini sumber kosong → daftar kosong
   → empty-state tabel.
   ========================================================================= */

import type { DashboardData, DokumenRow, LogbookRow, PembayaranRow } from './types';
import type { InventoryData } from '../inventory';
import { fmtNum } from '../format';

/* ------------------------------------------------------------ logbook ---- */

/** Divisi logbook yang boleh dilihat tiap role — verbatim LOG_DIVISI_BY_ROLE. */
export const LOG_DIVISI_BY_ROLE: Record<string, string[] | null> = {
  owner: null, // null = semua divisi
  admin: ['Admin', 'Keuangan'],
  marketing: ['Marketing'],
  sales: ['Sales'],
  operasional: ['Kebersihan', 'Inspeksi', 'Maintenance']
};

/**
 * PORT dari `logbookForRole()`. Owner (allowed = null) melihat SEMUA divisi.
 * Sumber lama mengembalikan null saat kosong lalu pemanggil memakai baris
 * sintetis; di sini selalu array — kosong berarti kosong.
 */
export function logbookForRole(logbook: LogbookRow[], role: string): LogbookRow[] {
  const allowed = LOG_DIVISI_BY_ROLE[role];
  if (allowed === undefined) return [];
  if (allowed === null) return logbook; // owner: semua divisi
  return logbook.filter((r) => allowed.includes(r.divisi));
}

/* ----------------------------------------------------------- dokumen ---- */

const DIVISI_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin & Keuangan',
  keuangan: 'Keuangan',
  marketing: 'Marketing',
  operasional: 'Operasional',
  sales: 'Sales'
};

export const divLabel = (r: unknown): string =>
  DIVISI_LABEL[String(r || '').toLowerCase()] || (r ? String(r) : '—');

export interface DokumenTableRow {
  id: string;
  nama: string;
  name: string;
  link: string;
  divisi: string;
}

/**
 * PORT dari `dokumenRows()` — HANYA cabang data live.
 * Owner melihat semua dokumen (+ kolom Divisi); role lain hanya miliknya.
 *
 * Catatan: kolom tabel memakai key `name` (renderer sel Nama), sedangkan sumber
 * mengisi `nama`. Keduanya diisi agar aman untuk kedua set kolom.
 */
export function dokumenRows(dokumen: DokumenRow[], role: string): DokumenTableRow[] {
  const rl = String(role).toLowerCase();
  if (!dokumen || !dokumen.length) return [];
  const list = rl === 'owner' ? dokumen : dokumen.filter((d) => (d.role || '').toLowerCase() === rl);
  return list.map((d) => ({
    id: d.id,
    nama: d.name,
    name: d.name,
    link: d.link,
    divisi: divLabel(d.role)
  }));
}

/* -------------------------------------------------------- pembayaran ---- */

/** Nama penghuni unik untuk dropdown filter Data Pembayaran. */
export function pembayaranNames(pembayaran: PembayaranRow[]): string[] {
  return [...new Set(pembayaran.map((r) => r.nama).filter(Boolean))].sort();
}

export function filterPembayaran(pembayaran: PembayaranRow[], nama?: string): PembayaranRow[] {
  return nama ? pembayaran.filter((r) => r.nama === nama) : pembayaran;
}

/* --------------------------------------------------------- inventory ---- */

export interface StokMaterialRow {
  name: string;
  category: string;
  stok: string;
  min: string;
  statusStok: string;
}

export interface StokTransaksiRow {
  tanggal: string;
  material: string;
  tipe: string;
  jumlah: string;
  biaya: string;
  oleh: string;
  catatan: string;
}

/** PORT dari bagian data `pageInventory()`. */
export function inventoryRows(inv: InventoryData | null): {
  materials: StokMaterialRow[];
  transactions: StokTransaksiRow[];
} {
  if (!inv) return { materials: [], transactions: [] };

  const materials = (inv.materials || []).map((m) => {
    const low = Number(m.current_stock) < Number(m.min_stock);
    return {
      name: m.name,
      category: m.category,
      stok: fmtNum(m.current_stock, m.unit),
      min: fmtNum(m.min_stock, m.unit),
      statusStok: low ? '⚠️ Menipis' : 'OK'
    };
  });

  const transactions = (inv.transactions || []).map((t) => ({
    // created_at bisa detik atau milidetik — deteksi pakai ambang 1e12, verbatim.
    tanggal: t.created_at
      ? new Date(Number(t.created_at) < 1e12 ? Number(t.created_at) * 1000 : Number(t.created_at))
          .toISOString()
          .slice(0, 10)
      : '',
    material: t.material_name,
    tipe: t.type === 'PURCHASE' ? 'Pembelian' : t.type === 'USAGE' ? 'Pemakaian' : 'Koreksi',
    jumlah: fmtNum(t.quantity, t.unit),
    biaya: t.total_cost != null ? 'Rp' + Math.round(t.total_cost).toLocaleString('id-ID') : '-',
    oleh: t.user_name || '-',
    catatan: t.notes || '-'
  }));

  return { materials, transactions };
}

/* -------------------------------------------------------------- kamar --- */

export const ROOM_BADGE: Record<string, string> = {
  Terisi: 'badge-full',
  Kosong: 'badge-empty',
  Booking: 'badge-soon',
  Maintenance: 'badge-maint'
};

export const ROOM_FILTERS = ['Semua', 'Terisi', 'Kosong', 'Booking', 'Maintenance'];

/* ------------------------------------------------------------- vendor --- */

/** Kolom vendor memakai key `name`; hidrasi mengisi `nama`. Samakan. */
export function vendorRows(data: DashboardData) {
  return data.vendor.map((v) => ({ ...v, name: v.nama }));
}

/* -------------------------------------------------------------- tiket --- */

/** Tiket dipakai apa adanya dari hidrasi — tanpa fallback sintetis. */
export function tiketRows(data: DashboardData) {
  return data.tiket;
}
