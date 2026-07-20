/* PORT VERBATIM dari `funnel()` public/app.js (Fase 4). */

export interface FunnelStage {
  label?: string;
  value: number;
}

const COLORS = ['#7a6f63', '#9a8a78', '#b8a890', '#d8c8b0'];

export default function Funnel({ stages }: { stages: FunnelStage[] }) {
  const w = 220;
  const h = 150;
  const max = stages[0].value;
  const seg = h / stages.length;

  return (
    <div className="funnel">
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
        {stages.map((s, i) => {
          const topW = (s.value / max) * w;
          const botW = i < stages.length - 1 ? (stages[i + 1].value / max) * w : topW * 0.7;
          const y = i * seg;
          const x0 = (w - topW) / 2;
          const x1 = (w - botW) / 2;
          return (
            <polygon
              key={i}
              points={`${x0},${y} ${x0 + topW},${y} ${x1 + botW},${y + seg - 4} ${x1},${y + seg - 4}`}
              fill={COLORS[i % COLORS.length]}
            />
          );
        })}
      </svg>
    </div>
  );
}
