import { Skeleton } from '@/components/ui/Skeleton';

/** Skeleton shimmer bersama (lihat src/components/ui/Skeleton.tsx). */
export default function OpsLoading() {
  return (
    <div className="module-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="module-card" style={{ pointerEvents: 'none' }}>
          <Skeleton height={40} width={40} style={{ borderRadius: 12 }} />
          <Skeleton height={16} width="70%" style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}
