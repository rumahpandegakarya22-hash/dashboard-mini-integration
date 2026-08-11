// Peta ikon lucide per modul + pengelompokan divisi untuk navigasi.
// Satu gaya ikon (stroke 24×24) di seluruh app — tidak ada emoji sebagai ikon.

import {
  ArrowLeftRight,
  BarChart3,
  CalendarCheck,
  CheckSquare,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  DoorOpen,
  FileCog,
  Globe,
  Hammer,
  HandCoins,
  History,
  LayoutGrid,
  ListTodo,
  Megaphone,
  MessagesSquare,
  PackageMinus,
  ReceiptText,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  UserCog,
  UserRoundPlus,
  Users,
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
    ids: ['pembayaran-sewa', 'pindah-kamar', 'aktivitas-finansial', 'feedback']
  },
  { label: 'Sales', ids: ['survey', 'tambah-waiting-list'] },
  { label: 'Marketing', ids: ['leads', 'konten', 'promosi'] },
  { label: 'Maintenance', ids: ['perawatan-preventif', 'perbaikan-korektif', 'pemakaian-stok-maintenance', 'tambah-vendor'] },
  { label: 'Inspeksi', ids: ['inspeksi-kebersihan', 'inspeksi-fasilitas', 'wo-inspeksi'] },
  { label: 'Cleaning', ids: ['wo-cleaning', 'pemakaian-stok-cleaning'] }
];

export const NAV_TEMAN_RARA: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/ops/admin/pengumuman', label: 'Pengumuman', icon: Megaphone },
  { href: '/ops/admin/akun-penghuni', label: 'Akun Penghuni', icon: UsersRound }
];

/** Halaman admin Landing Page — terpisah karena Marketing juga perlu akses (bukan hanya canKelola). */
export const NAV_LANDING_PAGE = { href: '/ops/admin/landing-page', label: 'Landing Page', icon: Globe };

/** Riwayat Pembayaran — owner, staff_admin, staff_sales. */
export const NAV_RIWAYAT_BAYAR = { href: '/ops/admin/riwayat-pembayaran', label: 'Riwayat Pembayaran', icon: History };

/** Halaman Setting Deposit + Kelola Kamar/User — hanya untuk owner/staff_admin (Pengaturan). */
export const NAV_PENGATURAN: { href: string; label: string; icon: LucideIcon; ownerOnly?: true }[] = [
  { href: '/ops/admin/wifi', label: 'Kredensial WiFi', icon: Wifi },
  { href: '/ops/admin/deposit', label: 'Setting Deposit', icon: HandCoins },
  { href: '/ops/admin/kamar', label: 'Kelola Harga Kamar', icon: Tag, ownerOnly: true },
  { href: '/ops/admin/users', label: 'Kelola User', icon: Users, ownerOnly: true }
];

/** Ubah Data Penghuni — dipindah dari Teman Rara ke area Administrasi. */
export const NAV_PENGHUNI = { href: '/ops/admin/penghuni', label: 'Ubah Data Penghuni', icon: UserCog };

/** Navigasi grup Check-in — owner, staff_admin, staff_inspeksi. */
export const NAV_CHECKIN: { href: string; label: string; icon: LucideIcon; adminOnly?: true }[] = [
  { href: '/ops/admin/daftar-booking', label: 'Daftar Booking', icon: CalendarCheck, adminOnly: true },
  { href: '/ops/admin/pre-checkin', label: 'Pre-Check In Form', icon: ClipboardCheck },
  { href: '/ops/admin/approval-checkin', label: 'Approval Check-in', icon: CheckSquare, adminOnly: true },
  { href: '/ops/m/penghuni-baru', label: 'Penghuni Baru & Review', icon: UserRoundPlus, adminOnly: true },
];

/** Laporan Keuangan PSAK — owner, staff_admin, staff_sales. */
export const NAV_LAPORAN_KEUANGAN = { href: '/ops/admin/laporan-keuangan', label: 'Laporan Keuangan', icon: BarChart3 };

/** Navigasi grup Check-out — owner, staff_admin, staff_inspeksi. */
export const NAV_CHECKOUT: { href: string; label: string; icon: LucideIcon; adminOnly?: true }[] = [
  { href: '/ops/m/checkout', label: 'Daftar Pengajuan Checkout', icon: DoorOpen, adminOnly: true },
  { href: '/ops/admin/pre-checkout', label: 'Pre-Check Out Form', icon: ClipboardList },
  { href: '/ops/admin/approval-checkout', label: 'Approval Check-out', icon: CheckSquare, adminOnly: true },
];
