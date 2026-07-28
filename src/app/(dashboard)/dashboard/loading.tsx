import { Skeleton } from '@/components/ui/Skeleton';

/** Skeleton shimmer bersama (lihat src/components/ui/Skeleton.tsx). */
export default function DashboardLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="stat-grid" style={{ ['--cols' as any]: 4 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card" style={{ minHeight: 116 }}>
            <Skeleton height={13} width="50%" />
            <Skeleton height={26} width="70%" style={{ marginTop: 10 }} />
          </div>
        ))}
      </section>
      <div className="card">
        <Skeleton height={20} width="30%" />
        <Skeleton height={200} style={{ marginTop: 16 }} />
      </div>
    </div>
  );
}
