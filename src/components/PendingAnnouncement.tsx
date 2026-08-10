import Link from 'next/link';
import { CircleAlert } from 'lucide-react';
import { turso } from '@/lib/core/turso';
import type { Role } from '@/lib/core/roles';

interface Counts {
  pindah: number;
  checkout: number;
  pengaduan: number;
}

async function fetchCounts(): Promise<Counts> {
  try {
    const db = turso();
    const [pindahRes, checkoutRes, pengaduanRes] = await Promise.all([
      db.execute("SELECT COUNT(*) AS n FROM tr_pindah_request WHERE status = 'Menunggu'"),
      db.execute("SELECT COUNT(*) AS n FROM tr_checkout_request WHERE status = 'Menunggu'"),
      db.execute("SELECT COUNT(*) AS n FROM tenant_complain WHERE status NOT IN ('Selesai','Dibatalkan')")
    ]);
    return {
      pindah: Number(pindahRes.rows[0]?.n ?? 0),
      checkout: Number(checkoutRes.rows[0]?.n ?? 0),
      pengaduan: Number(pengaduanRes.rows[0]?.n ?? 0)
    };
  } catch {
    return { pindah: 0, checkout: 0, pengaduan: 0 };
  }
}

export default async function PendingAnnouncement({ role }: { role: Role }) {
  const isAdmin = role === 'owner' || role === 'pengawas' || role === 'staff_admin';
  if (!isAdmin) return null;

  const counts = await fetchCounts();
  const items: { label: string; href: string; count: number }[] = [];

  if (counts.pindah > 0)
    items.push({ label: `${counts.pindah} pengajuan pindah kamar menunggu tindak lanjut`, href: '/ops/m/pindah-kamar', count: counts.pindah });
  if (counts.checkout > 0)
    items.push({ label: `${counts.checkout} pengajuan checkout menunggu tindak lanjut`, href: '/ops/m/checkout', count: counts.checkout });
  if (counts.pengaduan > 0)
    items.push({ label: `${counts.pengaduan} pengaduan penghuni belum selesai`, href: '/ops/m/feedback', count: counts.pengaduan });

  if (items.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="banner warn"
          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontWeight: 500 }}
        >
          <CircleAlert size={16} style={{ flexShrink: 0 }} />
          {item.label}
        </Link>
      ))}
    </div>
  );
}
