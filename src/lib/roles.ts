export type Role =
  | 'owner'
  | 'pengawas'
  | 'staff_admin'
  | 'staff_sales'
  | 'staff_marketing'
  | 'staff_maintenance'
  | 'staff_inspeksi'
  | 'staff_cleaning'
  | 'staff_finance';

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  pengawas: 'Pengawas',
  staff_admin: 'Staff Admin',
  staff_sales: 'Staff Sales',
  staff_marketing: 'Staff Marketing',
  staff_maintenance: 'Staff Maintenance',
  staff_inspeksi: 'Staff Inspeksi',
  staff_cleaning: 'Staff Cleaning',
  staff_finance: 'Staff Finance'
};

/** Modul yang boleh diakses tiap role (owner & pengawas: semua). */
export const MODULE_ACCESS: Record<string, Role[]> = {
  'penghuni-baru': ['staff_admin'],
  'pembayaran-sewa': ['staff_admin'],
  'pindah-kamar': ['staff_admin'],
  'checkout': ['staff_admin'],
  'pengeluaran': ['staff_admin'],
  'feedback': ['staff_admin'],
  'survey': ['staff_sales'],
  'leads': ['staff_marketing'],
  'konten': ['staff_marketing'],
  'promosi': ['staff_marketing'],
  'perawatan-preventif': ['staff_maintenance'],
  'perbaikan-korektif': ['staff_maintenance'],
  'inspeksi-kebersihan': ['staff_inspeksi'],
  'inspeksi-fasilitas': ['staff_inspeksi'],
  'wo-inspeksi': ['staff_inspeksi'],
  'wo-cleaning': ['staff_cleaning'],
  'daily-task': [
    'staff_admin',
    'staff_sales',
    'staff_marketing',
    'staff_maintenance',
    'staff_inspeksi',
    'staff_cleaning',
    'staff_finance'
  ]
};

export function canAccess(role: Role, moduleId: string): boolean {
  if (role === 'owner' || role === 'pengawas') return true;
  return (MODULE_ACCESS[moduleId] || []).includes(role);
}

/** Divisi (nilai di DB Turso) tiap role staff — dipakai joblist/notif work order. */
export const ROLE_DIVISI: Partial<Record<Role, string>> = {
  staff_admin: 'Admin',
  staff_sales: 'Sales',
  staff_marketing: 'Marketing',
  staff_maintenance: 'Maintenance',
  staff_inspeksi: 'Inspeksi',
  staff_cleaning: 'Cleaning',
  staff_finance: 'Finance'
};
