import type { Role } from '@/lib/core/roles';

/**
 * Halaman Inventory yang mengubah saldo/uang (pembelian, koreksi, opname,
 * kelola bahan) dibatasi Owner & Pengawas. Staf tetap boleh melihat daftar
 * stok, dan mencatat pemakaian lewat modul Mini App seperti biasa.
 */
export function bolehKelola(role: Role): boolean {
  return role === 'owner' || role === 'pengawas';
}
