/**
 * Skeleton shimmer bersama — dipakai lintas Dashboard/Ops/Inventory.
 * Warna diambil dari token per-app (`.skeleton` di masing-masing theme-*.css),
 * mekanisme animasi (keyframe shimmer) satu-satunya, hidup di globals.css.
 */
export function Skeleton({
  height = 16,
  width = '100%',
  className = '',
  style
}: {
  height?: number | string;
  width?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`.trim()} style={{ height, width, ...style }} />;
}

/** Kartu skeleton generik: satu judul pendek + beberapa baris. */
export function SkeletonCard({ lines = 2, label = 'Memuat' }: { lines?: number; label?: string }) {
  return (
    <div className="card" aria-busy="true" aria-label={label}>
      <Skeleton height={20} width="40%" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={44} style={{ marginTop: i === 0 ? 14 : 8 }} />
      ))}
    </div>
  );
}

export default Skeleton;
