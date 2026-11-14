// Satu daftar role untuk Dashboard, Mini App Ops, dan Inventory Stock.
export const ROLES = ['owner', 'pengawas', 'admin_finance', 'operasional', 'sales', 'marketing'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  pengawas: 'Pengawas',
  admin_finance: 'Admin and Finance',
  operasional: 'Operasional',
  sales: 'Sales',
  marketing: 'Marketing'
};

/** Role yang boleh masuk Dashboard (Pengawas hanya ada di Mini App Ops). */
export const DASHBOARD_ROLES = ['owner', 'admin_finance', 'marketing', 'operasional', 'sales'] as const;
export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

/** Kunci lama yang masih tersimpan di Clerk sebelum migrasi → kunci baru. */
export const LEGACY_ROLE_ALIAS: Record<string, Role> = {
  admin: 'admin_finance',
  staff_admin: 'admin_finance',
  staff_finance: 'admin_finance',
  staff_maintenance: 'operasional',
  staff_inspeksi: 'operasional',
  staff_cleaning: 'operasional',
  staff_sales: 'sales',
  staff_marketing: 'marketing'
};

/** Terima kunci baru maupun lama; selain itu null. Dipakai saat membaca metadata Clerk. */
export function normalizeRole(v: unknown): Role | null {
  if (typeof v !== 'string') return null;
  if ((ROLES as readonly string[]).includes(v)) return v as Role;
  return LEGACY_ROLE_ALIAS[v] ?? null;
}

export function isDashboardRole(r: unknown): r is DashboardRole {
  return typeof r === 'string' && (DASHBOARD_ROLES as readonly string[]).includes(r);
}

/** Modul yang boleh diakses tiap role (owner & pengawas: semua). */
export const MODULE_ACCESS: Record<string, Role[]> = {
  'penghuni-baru': ['admin_finance'],
  'pembayaran-sewa': ['admin_finance'],
  'pindah-kamar': ['admin_finance'],
  'checkout': ['admin_finance'],
  'pengeluaran': ['admin_finance'],
  'pendapatan-non-sewa': ['admin_finance'],
  'aktivitas-finansial': ['admin_finance'],
  'feedback': ['admin_finance'],
  'survey': ['sales'],
  'leads': ['marketing'],
  'konten': ['marketing'],
  'promosi': ['marketing'],
  'tambah-vendor': ['operasional'],
  'tambah-waiting-list': ['sales'],
  'perawatan-preventif': ['operasional'],
  'perbaikan-korektif': ['operasional'],
  'inspeksi-kebersihan': ['operasional'],
  'inspeksi-fasilitas': ['operasional'],
  'wo-inspeksi': ['operasional'],
  'wo-cleaning': ['operasional'],
  'pemakaian-stok-cleaning': ['operasional'],
  'pemakaian-stok-maintenance': ['operasional'],
  'daily-task': ['admin_finance', 'sales', 'marketing', 'operasional']
};

export function canAccess(role: Role, moduleId: string): boolean {
  if (role === 'owner' || role === 'pengawas') return true;
  return (MODULE_ACCESS[moduleId] || []).includes(role);
}

/**
 * Divisi di DB (work_orders.tujuan_divisi, dst.) yang ditangani tiap role.
 * Nilai DB tidak digabung: Operasional menangani ketiganya, Admin and Finance keduanya.
 */
export const ROLE_DIVISI: Partial<Record<Role, string[]>> = {
  admin_finance: ['Admin', 'Finance'],
  sales: ['Sales'],
  marketing: ['Marketing'],
  operasional: ['Maintenance', 'Inspeksi', 'Cleaning']
};

/** Pengelola Mini App (Kelola Kamar/User, Setting): owner + Admin and Finance. */
export const isAdminFinance = (r: Role | null | undefined): boolean => r === 'owner' || r === 'admin_finance';
