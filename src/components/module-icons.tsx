// Peta ikon lucide per modul + pengelompokan divisi untuk navigasi.
// Satu gaya ikon (stroke 24×24) di seluruh app — tidak ada emoji sebagai ikon.

import {
  ArrowLeftRight,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  Hammer,
  LayoutGrid,
  Megaphone,
  MessagesSquare,
  ReceiptText,
  Sparkles,
  TrendingUp,
  UserRoundPlus,
  Wallet,
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
  'inspeksi-fasilitas': ClipboardCheck
};

export function moduleIcon(id: string): LucideIcon {
  return MODULE_ICONS[id] ?? LayoutGrid;
}

/** Kelompok modul per divisi — urutan tampil di sidebar & beranda. */
export const DIVISION_GROUPS: { label: string; ids: string[] }[] = [
  {
    label: 'Administrasi',
    ids: ['penghuni-baru', 'pembayaran-sewa', 'pindah-kamar', 'checkout', 'pengeluaran', 'feedback']
  },
  { label: 'Sales', ids: ['survey'] },
  { label: 'Marketing', ids: ['leads', 'konten', 'promosi'] },
  { label: 'Maintenance', ids: ['perawatan-preventif', 'perbaikan-korektif'] },
  { label: 'Inspeksi', ids: ['inspeksi-kebersihan', 'inspeksi-fasilitas'] }
];
