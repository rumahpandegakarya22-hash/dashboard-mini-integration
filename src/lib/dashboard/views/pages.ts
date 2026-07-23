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

export interface StokMenipisRow {
  name: string;
  category: string;
  stok: string;
  min: string;
  kurang: string;
}

export interface StokTerpakaiRow {
  name: string;
  jumlah: string;
  frekuensi: number;
  biaya: string;
}

export interface InventoryOverviewData {
  totalJenis: number;
  jumlahTransaksi: number;
  dibawahMin: number;
  totalBiayaPemakaian: number;
  menipis: StokMenipisRow[];
  terpakai: StokTerpakaiRow[];
}

/**
 * Ringkasan untuk Overview Stok Inventory di Dashboard.
 *
 * "Pemakaian terbanyak" dihitung dari mutasi USAGE saja — pembelian dan koreksi
 * bukan pemakaian, dan mencampurnya membuat peringkat tidak berarti. Sumber
 * transaksinya 200 baris terakhir (batas query readInventory), jadi angkanya
 * ringkasan mutakhir, bukan total sepanjang masa.
 */
export function inventoryOverview(inv: InventoryData | null): InventoryOverviewData | null {
  if (!inv) return null;

  const materials = inv.materials || [];
  const transactions = inv.transactions || [];

  const menipis = materials
    .filter((m) => Number(m.current_stock) < Number(m.min_stock))
    .sort((a, b) => Number(a.current_stock) - Number(a.min_stock) - (Number(b.current_stock) - Number(b.min_stock)))
    .map((m) => ({
      name: m.name,
      category: m.category,
      stok: fmtNum(m.current_stock, m.unit),
      min: fmtNum(m.min_stock, m.unit),
      kurang: fmtNum(Number(m.min_stock) - Number(m.current_stock), m.unit)
    }));

  const pakai = new Map<string, { qty: number; n: number; biaya: number; unit: string }>();
  let totalBiayaPemakaian = 0;
  for (const t of transactions) {
    if (t.type !== 'USAGE') continue;
    const key = String(t.material_name);
    const cur = pakai.get(key) || { qty: 0, n: 0, biaya: 0, unit: String(t.unit ?? '') };
    cur.qty += Math.abs(Number(t.quantity) || 0); // quantity USAGE negatif
    cur.n += 1;
    cur.biaya += Number(t.total_cost) || 0;
    pakai.set(key, cur);
    totalBiayaPemakaian += Number(t.total_cost) || 0;
  }

  const terpakai = [...pakai.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, v]) => ({
      name,
      jumlah: fmtNum(v.qty, v.unit),
      frekuensi: v.n,
      biaya: v.biaya > 0 ? 'Rp' + Math.round(v.biaya).toLocaleString('id-ID') : '-'
    }));

  return {
    totalJenis: materials.length,
    jumlahTransaksi: transactions.length,
    dibawahMin: menipis.length,
    totalBiayaPemakaian,
    menipis,
    terpakai
  };
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
