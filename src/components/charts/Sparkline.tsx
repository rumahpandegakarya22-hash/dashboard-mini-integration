/* PORT VERBATIM dari `sparkline()` public/app.js (Fase 4).
   Geometri, kurva Catmull-Rom→Bezier, dan pembulatan 1 desimal dipertahankan
   persis agar path SVG yang dihasilkan identik piksel dengan versi lama. */

export interface SparklineProps {
  series: number[];
  color?: string;
}

export function sparklinePath(series: number[]): string {
  const s = Array.isArray(series) && series.length > 1 ? series.map(Number) : [0, 0];
  const w = 120;
  const h = 34;
  const max = Math.max(...s);
  const min = Math.min(...s);
  const rng = max - min || 1;
  const X = (i: number) => (i / (s.length - 1)) * w;
  const Y = (v: number) => h - 3 - ((v - min) / rng) * (h - 6);
  const pts = s.map((v, i) => [X(i), Y(v)] as [number, number]);

  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}

export default function Sparkline({ series, color }: SparklineProps) {
  return (
    <svg className="spark" viewBox="0 0 120 34" preserveAspectRatio="none">
      <path
        d={sparklinePath(series)}
        fill="none"
        stroke={color || 'rgba(255,255,255,.65)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
