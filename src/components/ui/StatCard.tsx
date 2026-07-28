'use client';

/* PORT VERBATIM dari `statCard()` / `statGrid()` public/app.js (Fase 4).

   Aturan warna tren dipertahankan apa adanya: HIJAU #13a05f = kenaikan,
   MERAH #e23d3d = penurunan — konsisten lintas seluruh scorecard. Garis di
   dalam kartu adalah sparkline DATA asli, bukan ornamen dekoratif. */

import { useEffect, useState } from 'react';
import { motion, animate } from 'framer-motion';
import Sparkline from '@/components/charts/Sparkline';
import { trendBadge } from '@/lib/dashboard/format';

/** Ubah warna hex dalam string gradien jadi rgba dengan alpha — verbatim `glassify()`. */
export const glassify = (grad: string, a: number): string =>
  String(grad).replace(/#([0-9a-fA-F]{6})/g, (_m, h: string) => {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  });

/** Pecah string angka terformat ("Rp1,2 Jt", "82 %", "24") jadi prefix/angka/suffix
 *  supaya bisa dihitung naik dari 0 tanpa kehilangan format aslinya (item 5 UAT). */
function splitFormattedNumber(v: string): { prefix: string; suffix: string; target: number; decimals: number } | null {
  const m = v.match(/-?\d[\d.,]*/);
  if (!m || m.index == null) return null;
  const numStr = m[0];
  const commaIdx = numStr.lastIndexOf(',');
  const decimals = commaIdx >= 0 ? numStr.length - commaIdx - 1 : 0;
  const target = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
  if (isNaN(target)) return null;
  return { prefix: v.slice(0, m.index), suffix: v.slice(m.index + numStr.length), target, decimals };
}

/** Nilai scorecard yang menghitung naik dari 0 ke nilai akhir saat masuk (item 5 UAT). */
function CountUpValue({ value, delay }: { value: string | number; delay: number }) {
  const str = String(value);
  const parts = splitFormattedNumber(str);
  const fmt = (n: number) =>
    parts
      ? parts.prefix +
        n.toLocaleString('id-ID', { minimumFractionDigits: parts.decimals, maximumFractionDigits: parts.decimals }) +
        parts.suffix
      : str;

  const [display, setDisplay] = useState(() => (parts ? fmt(0) : str));

  useEffect(() => {
    if (!parts) {
      setDisplay(str);
      return;
    }
    setDisplay(fmt(0));
    const controls = animate(0, parts.target, {
      duration: 0.9,
      delay,
      ease: [0.22, 0.61, 0.36, 1],
      onUpdate: (n) => setDisplay(fmt(n))
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [str]);

  return <>{display}</>;
}

export interface StatCardData {
  label: string;
  value: string | number;
  /** Deret untuk sparkline + perhitungan tren. */
  spark?: number[];
  /** Badge manual, dipakai hanya bila `spark` tidak cukup panjang. */
  badge?: string;
  dir?: 'up' | 'down';
  /** Gradien latar kartu. */
  bg: string;
  onDark?: boolean;
}

export function StatCard(c: StatCardData & { index?: number }) {
  const hasSeries = Array.isArray(c.spark) && c.spark.length > 1;
  const t = hasSeries ? trendBadge(c.spark) : c.badge ? { badge: c.badge, dir: c.dir || 'up' } : null;

  const up = t ? t.dir !== 'down' : true;
  const col = up ? '#13a05f' : '#e23d3d';
  const arrow = up ? '▲' : '▼';

  return (
    <motion.article
      className={`stat-card${c.onDark ? ' on-dark' : ''}`}
      style={{ background: glassify(c.bg, 0.58), position: 'relative' }}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: Math.min((c.index ?? 0) * 0.04, 0.32), ease: [0.22, 0.61, 0.36, 1] }}
    >
      <span className="stat-card__label">{c.label}</span>
      <motion.span
        className="stat-card__value"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: Math.min((c.index ?? 0) * 0.04, 0.32) + 0.08, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <CountUpValue value={c.value} delay={Math.min((c.index ?? 0) * 0.04, 0.32) + 0.08} />
      </motion.span>
      {t && (
        <span
          className="stat-card__badge"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            color: col,
            background: 'var(--badge-bg,rgba(255,255,255,.22))',
            padding: '3px 8px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 11,
            lineHeight: 1
          }}
        >
          {arrow} {t.badge}
        </span>
      )}
      <span className="stat-card__wave">
        <Sparkline series={c.spark || []} color={c.onDark ? 'rgba(255,255,255,.7)' : 'rgba(20,40,60,.45)'} />
      </span>
    </motion.article>
  );
}

export function StatGrid({ cards, cols }: { cards: StatCardData[]; cols: number }) {
  return (
    <section className="stat-grid" style={{ ['--cols' as any]: cols }}>
      {cards.map((c, i) => (
        <StatCard key={i} index={i} {...c} />
      ))}
    </section>
  );
}

export default StatCard;
