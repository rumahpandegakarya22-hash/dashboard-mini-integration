export type Role =
  | 'owner'
  | 'pengawas'
  | 'staff_admin'
  | 'staff_sales'
  | 'staff_marketing'
  | 'staff_maintenance'
  | 'staff_inspeksi';

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  pengawas: 'Pengawas',
  staff_admin: 'Staff Admin',
  staff_sales: 'Staff Sales',
  staff_marketing: 'Staff Marketing',
  staff_maintenance: 'Staff Maintenance',
  staff_inspeksi: 'Staff Inspeksi'
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
  'inspeksi-fasilitas': ['staff_inspeksi']
};

export function canAccess(role: Role, moduleId: string): boolean {
  if (role === 'owner' || role === 'pengawas') return true;
  return (MODULE_ACCESS[moduleId] || []).includes(role);
}
