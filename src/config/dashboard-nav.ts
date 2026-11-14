/* =========================================================================
   Navigasi Dashboard per role — PORT dari objek `ROLES` public/app.js (§8.2).

   Ini **sumber tunggal** untuk dua hal sekaligus:
     1. Menyusun sidebar (grup "Dashboards" vs "Pages").
     2. Menjaga akses per halaman — `/dashboard/[view]` menolak view yang tidak
        terdaftar untuk role pemanggil.

   Perbedaan dari sumber: `render:` (fungsi pembentuk markup) TIDAK ikut ke sini.
   Di App Router, halaman ditentukan rute — pemetaan view → komponen hidup di
   `app/(dashboard)/dashboard/[view]/page.tsx`. Yang tersisa di sini murni data
   navigasi, sehingga file ini bisa diimpor Server Component tanpa menyeret UI.
   ========================================================================= */

import type { DashboardRole } from './dashboard-access';

export interface NavPage {
  id: string;
  label: string;
  /** "dash" = overview (ikon bulat), "page" = halaman data (ikon caret). */
  group: 'dash' | 'page';
  /** Teks breadcrumb di topbar. */
  crumb: string;
}

export interface RoleNav {
  label: string;
  sidebarName: string;
  pages: NavPage[];
}

const OWNER_PAGES: NavPage[] = [
  { id: 'overview', label: 'Overview', group: 'dash', crumb: '__ROLE__' },
  { id: 'sales', label: 'Sales', group: 'dash', crumb: 'Sales' },
  { id: 'marketing', label: 'Marketing', group: 'dash', crumb: 'Marketing' },
  { id: 'admin', label: 'Admin and Finance', group: 'dash', crumb: 'Admin and Finance' },
  { id: 'operasional', label: 'Operasional', group: 'dash', crumb: 'Operasional' },
  { id: 'penghuni', label: 'Daftar Penghuni', group: 'page', crumb: 'Daftar Penghuni' },
  { id: 'kamar', label: 'Data Kamar', group: 'page', crumb: 'Data Kamar' },
  { id: 'pembayaran', label: 'Data Pembayaran', group: 'page', crumb: 'Data Pembayaran' },
  { id: 'vendor', label: 'Daftar Vendor', group: 'page', crumb: 'Daftar Vendor' },
  { id: 'tiket', label: 'Daftar Tiket', group: 'page', crumb: 'Daftar Tiket' },
  { id: 'waiting-list', label: 'Waiting List', group: 'page', crumb: 'Waiting List' },
  { id: 'stok', label: 'Stok Inventory', group: 'dash', crumb: 'Stok Inventory' },
  { id: 'dokumen', label: 'Dokumen', group: 'page', crumb: 'Dokumen' }
];
const pagesFor = (crumb: string): NavPage[] => OWNER_PAGES.map((p) => (p.id === 'overview' ? { ...p, crumb } : p));

export const ROLE_NAV: Record<DashboardRole, RoleNav> = {
  admin_finance: {
    label: 'Admin and Finance',
    sidebarName: 'Admin and Finance',
    pages: [
      { id: 'overview', label: 'Overview', group: 'dash', crumb: 'Admin' },
      { id: 'penghuni', label: 'Daftar Penghuni', group: 'page', crumb: 'Daftar Penghuni' },
      { id: 'pembayaran', label: 'Data Pembayaran', group: 'page', crumb: 'Data Pembayaran' },
      { id: 'vendor', label: 'Daftar Vendor', group: 'page', crumb: 'Daftar Vendor' },
      { id: 'stok', label: 'Stok Inventory', group: 'dash', crumb: 'Stok Inventory' },
      { id: 'dokumen', label: 'Dokumen', group: 'page', crumb: 'Dokumen' }
    ]
  },
  marketing: {
    label: 'Marketing',
    sidebarName: 'Marketing',
    pages: [
      { id: 'overview', label: 'Overview', group: 'dash', crumb: 'Marketing' },
      { id: 'leads', label: 'Daftar Leads', group: 'page', crumb: 'Daftar Leads' },
      { id: 'konten', label: 'Konten', group: 'page', crumb: 'Konten' },
      { id: 'promosi', label: 'Promosi', group: 'page', crumb: 'Promosi' },
      { id: 'dokumen', label: 'Dokumen', group: 'page', crumb: 'Dokumen' }
    ]
  },
  operasional: {
    label: 'Operasional',
    sidebarName: 'Operasional',
    pages: [
      { id: 'overview', label: 'Overview', group: 'dash', crumb: 'Operasional' },
      { id: 'tiket', label: 'Daftar Tiket', group: 'page', crumb: 'Daftar Tiket' },
      { id: 'vendor', label: 'Daftar Vendor', group: 'page', crumb: 'Daftar Vendor' },
      { id: 'stok', label: 'Stok Inventory', group: 'dash', crumb: 'Stok Inventory' },
      { id: 'kamar', label: 'Data Kamar', group: 'page', crumb: 'Data Kamar' },
      { id: 'dokumen', label: 'Dokumen', group: 'page', crumb: 'Dokumen' }
    ]
  },
  sales: {
    label: 'Sales',
    sidebarName: 'Sales',
    pages: [
      { id: 'overview', label: 'Overview', group: 'dash', crumb: 'Sales' },
      { id: 'prospek', label: 'Daftar Prospek', group: 'page', crumb: 'Daftar Prospek' },
      { id: 'penghuni', label: 'Daftar Penghuni', group: 'page', crumb: 'Daftar Penghuni' },
      { id: 'kamar', label: 'Data Kamar', group: 'page', crumb: 'Data Kamar' },
      { id: 'waiting-list', label: 'Waiting List', group: 'page', crumb: 'Waiting List' },
      { id: 'dokumen', label: 'Dokumen', group: 'page', crumb: 'Dokumen' }
    ]
  },
  owner: { label: 'Owner', sidebarName: 'Owner', pages: pagesFor('Owner') },
  pengawas: { label: 'Pengawas', sidebarName: 'Pengawas', pages: pagesFor('Pengawas') }
};

/** Periode filter — verbatim `PERIODS` app.js. Default lama: "Tahun ini". */
export const PERIODS = ['Hari ini', 'Minggu ini', 'Bulan ini', 'Tahun ini', 'Custom'] as const;
export const DEFAULT_PERIOD = 'Tahun ini';

/** Guard per halaman: apakah role boleh membuka view ini? */
export function canOpenView(role: DashboardRole, view: string): boolean {
  return ROLE_NAV[role].pages.some((p) => p.id === view);
}

export function findPage(role: DashboardRole, view: string): NavPage | undefined {
  return ROLE_NAV[role].pages.find((p) => p.id === view);
}
