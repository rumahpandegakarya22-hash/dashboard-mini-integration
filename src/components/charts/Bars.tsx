'use client';


import { motion } from 'framer-motion';
import { fmtNum, niceTicks } from '@/lib/dashboard/format';
import { useBox } from './useBox';

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
  const { ref, w, h } = useBox(320, 230);
  const padL = 38;
  const rotasi = cats.some((c) => String(c).length >= 8);
  const padB = rotasi ? 54 : 30;
  const padT = 16;
  const cw = w - padL;
  const ch = h - padB - padT;

  const rawMax = Math.max(1, ...vals.map(Number));
  const max = rawMax * 1.18;
  const bw = Math.min((cw / cats.length) * 0.42, 56);
  const gap = cw / cats.length;
  const ticks = niceTicks(rawMax, 4, unit);

  return (
    <div className="chart" ref={ref} style={{ minHeight: 230 }}>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
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
              <motion.rect
                x={x}
                width={bw}
                rx={bw / 2}
                fill={`url(#${gradId})`}
                style={{ transformOrigin: `${x + bw / 2}px ${padT + ch}px`, pointerEvents: 'all' }}
                initial={{ y: padT + ch, height: 0 }}
                animate={{ y, height: bh }}
                transition={{ duration: 0.7, delay: i * 0.05, ease: [0.22, 0.61, 0.36, 1] }}
                data-tip-label={cats[i]}
                data-tip-value={fmtNum(v, unit)}
                data-tip-color="var(--brand)"
              />
              <motion.text
                className="chart-val"
                x={x + bw / 2}
                y={y - 5}
                textAnchor="middle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: i * 0.05 + 0.35 }}
              >
                {fmtNum(v, unit)}
              </motion.text>
              {rotasi ? (
                <text
                  className="chart-cat"
                  style={{ fontSize: 8 }}
                  x={x + bw / 2}
                  y={h - padB + 14}
                  textAnchor="end"
                  transform={`rotate(-35 ${x + bw / 2} ${h - padB + 14})`}
                >
                  {cats[i]}
                </text>
              ) : (
                <text className="chart-cat" x={x + bw / 2} y={h - 8} textAnchor="middle">
                  {cats[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
