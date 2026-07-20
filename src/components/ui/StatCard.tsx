/* PORT VERBATIM dari `statCard()` / `statGrid()` public/app.js (Fase 4).

   Aturan warna tren dipertahankan apa adanya: HIJAU #13a05f = kenaikan,
   MERAH #e23d3d = penurunan — konsisten lintas seluruh scorecard. Garis di
   dalam kartu adalah sparkline DATA asli, bukan ornamen dekoratif. */

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

export function StatCard(c: StatCardData) {
  const hasSeries = Array.isArray(c.spark) && c.spark.length > 1;
  const t = hasSeries ? trendBadge(c.spark) : c.badge ? { badge: c.badge, dir: c.dir || 'up' } : null;

  const up = t ? t.dir !== 'down' : true;
  const col = up ? '#13a05f' : '#e23d3d';
  const arrow = up ? '▲' : '▼';

  return (
    <article className={`stat-card${c.onDark ? ' on-dark' : ''}`} style={{ background: glassify(c.bg, 0.58), position: 'relative' }}>
      <span className="stat-card__label">{c.label}</span>
      <span className="stat-card__value">{c.value}</span>
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
    </article>
  );
}

export function StatGrid({ cards, cols }: { cards: StatCardData[]; cols: number }) {
  return (
    <section className="stat-grid" style={{ ['--cols' as any]: cols }}>
      {cards.map((c, i) => (
        <StatCard key={i} {...c} />
      ))}
    </section>
  );
}

export default StatCard;
