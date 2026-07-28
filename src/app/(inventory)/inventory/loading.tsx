import { Skeleton } from '@/components/ui/Skeleton';

/** Skeleton shimmer bersama (lihat src/components/ui/Skeleton.tsx). */
export default function InventoryLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="glass-card rounded-2xl p-6">
            <Skeleton height={12} width="60%" />
            <Skeleton height={36} width="40%" style={{ marginTop: 12 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
