// Peta ikon lucide per modul + pengelompokan divisi untuk navigasi.
// Satu gaya ikon (stroke 24×24) di seluruh app — tidak ada emoji sebagai ikon.

import {
  ArrowLeftRight,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  DoorOpen,
  FileCog,
  Globe,
  Hammer,
  LayoutGrid,
  ListTodo,
  Megaphone,
  MessagesSquare,
  PackageMinus,
  ReceiptText,
  Sparkles,
  Store,
  TrendingUp,
  UserCog,
  UserRoundPlus,
  UsersRound,
  Wallet,
  Wifi,
  Wrench,
  type LucideIcon
} from 'lucide-react';

const MODULE_ICONS: Record<string, LucideIcon> = {
  'penghuni-baru': UserRoundPlus,
  'pembayaran-sewa': Wallet,
  'pindah-kamar': ArrowLeftRight,
  'checkout': DoorOpen,
  'pengeluaran': ReceiptText,
  'feedback': MessagesSquare,
  'survey': ClipboardList,
  'leads': TrendingUp,
  'konten': Clapperboard,
  'promosi': Megaphone,
  'perawatan-preventif': Wrench,
  'perbaikan-korektif': Hammer,
  'inspeksi-kebersihan': Sparkles,
  'inspeksi-fasilitas': ClipboardCheck,
  'wo-inspeksi': FileCog,
  'wo-cleaning': FileCog,
  'pemakaian-stok-cleaning': PackageMinus,
  'pemakaian-stok-maintenance': PackageMinus,
  'daily-task': ListTodo,
  'aktivitas-finansial': ReceiptText,
  'tambah-vendor': Store,
  'tambah-waiting-list': ClipboardPlus
};

export function moduleIcon(id: string): LucideIcon {
  return MODULE_ICONS[id] ?? LayoutGrid;
}

/** Kelompok modul per divisi — urutan tampil di sidebar & beranda. */
export const DIVISION_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Umum', ids: ['daily-task'] },
  {
    label: 'Administrasi',
    ids: ['penghuni-baru', 'pembayaran-sewa', 'pindah-kamar', 'checkout', 'aktivitas-finansial', 'feedback']
  },
  { label: 'Sales', ids: ['survey', 'tambah-waiting-list'] },
  { label: 'Marketing', ids: ['leads', 'konten', 'promosi'] },
  { label: 'Maintenance', ids: ['perawatan-preventif', 'perbaikan-korektif', 'pemakaian-stok-maintenance', 'tambah-vendor'] },
  { label: 'Inspeksi', ids: ['inspeksi-kebersihan', 'inspeksi-fasilitas', 'wo-inspeksi'] },
  { label: 'Cleaning', ids: ['wo-cleaning', 'pemakaian-stok-cleaning'] }
];

/**
 * Halaman pengelola untuk data yang berasal dari aplikasi penghuni Teman Rara.
 * Bukan modul form, jadi tidak masuk MODULES registry — didaftarkan di sini agar
 * sidebar (AppShell) dan grid beranda (HomeMenu) memakai daftar yang sama.
 */
export const NAV_TEMAN_RARA: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/ops/admin/pengumuman', label: 'Pengumuman', icon: Megaphone },
  { href: '/ops/admin/wifi', label: 'Kredensial WiFi', icon: Wifi },
  { href: '/ops/admin/akun-penghuni', label: 'Akun Penghuni', icon: UsersRound },
  { href: '/ops/admin/penghuni', label: 'Ubah Data Penghuni', icon: UserCog }
];

/** Halaman admin Landing Page — terpisah karena Marketing juga perlu akses (bukan hanya canKelola). */
export const NAV_LANDING_PAGE = { href: '/ops/admin/landing-page', label: 'Landing Page', icon: Globe };
