'use client';

/* PORT VERBATIM dari `lineChart()` public/app.js (Fase 4).
   Multi-seri (2–3) dengan marker; sumbu Y dinamis dan MENDUKUNG NILAI NEGATIF
   (dipakai Laba Bersih). Seri ke-2 bergaris putus-putus, seri ke-1 diberi area
   gradien — sama persis seperti versi lama. */

import { motion } from 'framer-motion';
import { fmtNum } from '@/lib/dashboard/format';

const LINE_COLORS =['var(--teal)', 'var(--text-2)', '#e0a13a'];

export interface AreaLineProps {
  seriesList: number[][] | number[];
  xLabels: string[];
  names?: string[];
  unit?: string;
  /** id gradien area — unik per halaman bila ada >1 chart. */
  gradId?: string;
}

export default function AreaLine({ seriesList, xLabels, names, unit, gradId = 'lcArea' }: AreaLineProps) {
  const w = 460;
  const h = 200;
  const padL = 48;
  const padB = 24;
  const padT = 14;
  const cw = w - padL - 6;
  const ch = h - padB - padT;

  const series = (Array.isArray(seriesList[0]) ? (seriesList as number[][]) : [seriesList as number[]]).filter(
    (s) => Array.isArray(s) && s.length
  );
  const nm = names || ['Pendapatan Kotor', 'Beban Operasional', 'Laba Bersih'];
  const all = series.flat().map(Number);
  const rawMax = Math.max(1, ...all);
  const rawMin = Math.min(0, ...all);
  const span = rawMax - rawMin || 1;

  const X = (i: number, len: number) => padL + (i / Math.max(1, len - 1)) * cw;
  const Y = (v: number) => padT + ch - ((Number(v) - rawMin) / span) * ch;

  const path = (s: number[]): string => {
    if (!s.length) return '';
    const pts = s.map((v, i) => [X(i, s.length), Y(v)] as [number, number]);
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[Math.max(0, i - 1)];
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = x1 + (x2 - x0) / 6;
      const cp1y = y1 + (y2 - y0) / 6;
      const cp2x = x2 - (x3 - x1) / 6;
      const cp2y = y2 - (y3 - y1) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
    return d;
  };

  const ticks = Array.from({ length: 4 }, (_, i) => fmtNum(Math.round(rawMin + (span / 3) * i), unit));

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--teal)" stopOpacity=".28" />
            <stop offset="100%" stopColor="var(--teal)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((lab, i) => {
          const y = padT + ch - (i / 3) * ch;
          return (
            <g key={`t${i}`}>
              <line x1={padL} y1={y} x2={w - 6} y2={y} stroke="var(--rail)" strokeWidth="1" opacity=".45" />
              <text className="chart-axis" x={padL - 8} y={y + 3} textAnchor="end">
                {lab}
              </text>
            </g>
          );
        })}

        {xLabels.map((lab, i) => (
          <text key={`x${i}`} className="chart-cat" x={X(i, xLabels.length)} y={h - 6} textAnchor="middle">
            {lab}
          </text>
        ))}

        {series[0] && (
          <motion.path
            d={`${path(series[0])} L ${X(series[0].length - 1, series[0].length)} ${padT + ch} L ${padL} ${padT + ch} Z`}
            fill={`url(#${gradId})`}
            initial={{ clipPath: 'inset(100% 0 0 0)' }}
            animate={{ clipPath: 'inset(0% 0 0 0)' }}
            transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
          />
        )}

        {series.map((s, i) =>
          i === 1 ? (
            // Seri putus-putus: pathLength framer-motion menimpa strokeDasharray
            // manual, jadi cukup fade-in supaya pola dash "5 5" tetap utuh.
            <motion.path
              key={`l${i}`}
              d={path(s)}
              fill="none"
              stroke={LINE_COLORS[i] || 'var(--teal)'}
              strokeWidth={2}
              strokeDasharray="5 5"
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 0.61, 0.36, 1] }}
            />
          ) : (
            <motion.path
              key={`l${i}`}
              d={path(s)}
              fill="none"
              stroke={LINE_COLORS[i] || 'var(--teal)'}
              strokeWidth={i === 0 ? 2.2 : 2}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.0, delay: i * 0.1, ease: [0.22, 0.61, 0.36, 1] }}
            />
          )
        )}

        {series.map((s, si) => {
          const color = LINE_COLORS[si] || 'var(--teal)';
          const name = nm[si] || `Seri ${si + 1}`;
          return s.map((v, i) => {
            const x = X(i, s.length);
            const y = Y(v);
            return (
              <g key={`d${si}-${i}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={10}
                  fill="transparent"
                  className="line-hit"
                  data-tip-label={`${name} · ${xLabels[i] || ''}`}
                  data-tip-value={fmtNum(v, unit)}
                  data-tip-color={color}
                />
                <circle cx={x} cy={y} r={3} fill="var(--card)" stroke={color} strokeWidth="2" />
              </g>
            );
          });
        })}
      </svg>
    </div>
  );
}
