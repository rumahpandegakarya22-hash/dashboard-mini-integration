'use client';

/* PORT VERBATIM dari `donut()` public/app.js (Fase 4).
   Kaidah viz dipertahankan: butt-cap (tanpa cap bulat yang mendistorsi
   proporsi) + celah keliling konstan 2px, bukan celah per-segmen. */

import { motion } from 'framer-motion';
import { useState } from 'react';

export interface DonutSegment {
  label?: string;
  value: number;
  color: string;
  /** Nilai tampilan pengganti `value` di tooltip (mis. sudah diformat rupiah). */
  disp?: string | number;
}

export interface DonutProps {
  segments: DonutSegment[];
  center?: { label: string; value: string | number };
}

interface Tip { label: string; value: string; color: string; x: number; y: number }

export default function Donut({ segments, center }: DonutProps) {
  const [tip, setTip] = useState<Tip | null>(null);
  const size = 160;
  const r = 60;
  const cx = size / 2;
  const cy = size / 2;
  const sw = 22;
  const C = 2 * Math.PI * r;

  const segs = (segments || []).filter((s) => Number(s.value) > 0);
  const total = segs.reduce((s, x) => s + Number(x.value), 0) || 1;
  const gap = segs.length > 1 ? 2 : 0;

  let offset = 0;
  const rings = segs.map((s, i) => {
    const frac = Number(s.value) / total;
    const len = frac * C;
    const pct = Math.round(frac * 100);
    const draw = Math.max(0.5, len - gap);
    const node = (
      <motion.circle
        key={i}
        className="donut__seg"
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        style={{ pointerEvents: 'all' }}
        stroke={s.color}
        strokeWidth={sw}
        strokeLinecap="butt"
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        data-tip-label={s.label || ''}
        data-tip-value={`${s.disp != null ? s.disp : s.value} · ${pct}%`}
        data-tip-color={s.color}
        initial={{ strokeDasharray: `0 ${C}` }}
        animate={{ strokeDasharray: `${draw} ${C - draw}` }}
        transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 0.61, 0.36, 1] }}
      />
    );
    offset += len;
    return node;
  });

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const el = (e.target as Element).closest('[data-tip-label]') as SVGElement | null;
    if (!el) { setTip(null); return; }
    setTip({
      label: el.getAttribute('data-tip-label') || '',
      value: el.getAttribute('data-tip-value') || '',
      color: el.getAttribute('data-tip-color') || '',
      x: e.clientX,
      y: e.clientY
    });
  };

  return (
    <div className="donut__chart">
      <svg viewBox={`0 0 ${size} ${size}`} style={{ pointerEvents: 'all' }}
        onMouseMove={handleMove} onMouseLeave={() => setTip(null)}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--rail)" strokeWidth={sw} opacity=".3" />
        {rings}
      </svg>
      {center && (
        <div className="donut__center">
          <small>{center.label}</small>
          <b>{center.value}</b>
        </div>
      )}
      {tip && (
        <div className="chart-tip" style={{ left: tip.x + 14, top: tip.y - 10 }}>
          <span className="chart-tip__dot" style={{ background: tip.color }} />
          <span className="chart-tip__lab">{tip.label}</span>
          <b>{tip.value}</b>
        </div>
      )}
    </div>
  );
}
