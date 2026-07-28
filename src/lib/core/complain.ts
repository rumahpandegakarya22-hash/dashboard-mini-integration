// Kosakata status pengaduan — dipakai bersama Ops dan aplikasi penghuni
// (teman-rara/src/lib/kategori.ts memakai daftar yang sama).
//
// `tenant_complain.status` bertipe TEXT bebas tanpa CHECK, jadi tidak ada yang
// mencegah dua aplikasi menulis kosakata berbeda ke kolom yang sama. Sebelum
// migrasi 004, Ops menulis 'Review' sementara aplikasi penghuni hanya mengenal
// Menunggu/Diproses/Selesai — akibatnya progres kerja pengelola tampil sebagai
// "Menunggu" di layar penghuni. File ini jadi satu-satunya sumber kebenarannya
// di sisi Ops; jangan menulis status pengaduan dari string literal.

export const STATUS_PENGADUAN = ['Menunggu', 'Diproses', 'Selesai', 'Dibatalkan'] as const;
export type StatusPengaduan = (typeof STATUS_PENGADUAN)[number];

/** Status yang masih perlu ditindak — default filter antrean pengelola. */
export const STATUS_TERBUKA: StatusPengaduan[] = ['Menunggu', 'Diproses'];

export function isStatusPengaduan(v: unknown): v is StatusPengaduan {
  return typeof v === 'string' && (STATUS_PENGADUAN as readonly string[]).includes(v);
}

/**
 * Petakan nilai apa adanya dari database ke kosakata baku. 'Review' adalah
 * nilai lama pra-004 yang mungkin masih tersisa di baris historis.
 */
export function normalisasiStatus(status: string | null | undefined): StatusPengaduan {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'selesai') return 'Selesai';
  if (s === 'diproses') return 'Diproses';
  if (s === 'dibatalkan') return 'Dibatalkan';
  return 'Menunggu';
}
