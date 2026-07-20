/* PORT VERBATIM dari `barChart()` public/app.js (Fase 4).
   Sumbu Y dinamis dari data; headroom 1.18× dipertahankan; label nilai di atas
   tiap batang. Parameter `_legacyY` versi lama sudah tak dipakai dan tidak ikut. */

import { fmtNum, niceTicks } from '@/lib/dashboard/format';

export interface BarsProps {
  cats: string[];
  vals: number[];
  /** id unik untuk <linearGradient> — harus unik per halaman. */
  gradId: string;
  /** <stop> gradien, mis. warna hijau/hangat/dingin per palet role. */
  gradStops: React.ReactNode;
  unit?: string;
}

export default function Bars({ cats, vals, gradId, gradStops, unit }: BarsProps) {
  const w = 320;
  const h = 178;
  const padL = 38;
  const padB = 30;
  const padT = 16;
  const cw = w - padL;
  const ch = h - padB - padT;

  const rawMax = Math.max(1, ...vals.map(Number));
  const max = rawMax * 1.18;
  const bw = (cw / cats.length) * 0.42;
  const gap = cw / cats.length;
  const ticks = niceTicks(rawMax, 4, unit);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            {gradStops}
          </linearGradient>
        </defs>

        {ticks.map((lab, i) => {
          const y = padT + ch - (i / (ticks.length - 1)) * ch;
          return (
            <g key={`t${i}`}>
              <line x1={padL} y1={y} x2={w} y2={y} stroke="var(--rail)" strokeWidth="1" opacity=".5" />
              <text className="chart-axis" x={padL - 6} y={y + 3} textAnchor="end">
                {lab}
              </text>
            </g>
          );
        })}

        {vals.map((v, i) => {
          const bh = (Number(v) / max) * ch;
          const x = padL + gap * i + gap / 2 - bw / 2;
          const y = padT + ch - bh;
          return (
            <g key={`b${i}`}>
              <rect x={x} y={y} width={bw} height={bh} rx={bw / 2} fill={`url(#${gradId})`} />
              <text className="chart-val" x={x + bw / 2} y={y - 5} textAnchor="middle">
                {fmtNum(v, unit)}
              </text>
              <text className="chart-cat" x={x + bw / 2} y={h - 8} textAnchor="middle">
                {cats[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
