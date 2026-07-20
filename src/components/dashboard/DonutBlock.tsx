/* PORT VERBATIM dari `donutBlock()` public/app.js (Fase 4).

   Kaidah viz yang dipertahankan persis:
   - segmen diurut besar→kecil,
   - bila >6 segmen, 5 teratas ditahan dan sisanya digabung jadi "Lainnya",
   - center donut = TOTAL (the whole), bukan nilai segmen terbesar,
   - periode tanpa data → empty-state, BUKAN donut palsu. */

import Donut from '@/components/charts/Donut';
import { EmptyCard } from '@/components/charts/ChartCard';
import { fmtNum } from '@/lib/dashboard/format';
import { fmtRpShort } from '@/lib/dashboard/views/finance';

export interface DonutSeg {
  /** teks legenda */
  t: string;
  value: number;
  /** warna */
  c: string;
}

export interface DonutBlockProps {
  label: string;
  segs: DonutSeg[];
  money?: boolean;
  unit?: string;
  center?: false;
  centerLabel?: string;
}

export default function DonutBlock({ label, segs, money, unit, center, centerLabel }: DonutBlockProps) {
  let arr = (segs || [])
    .filter((s) => Number(s.value) > 0)
    .slice()
    .sort((a, b) => Number(b.value) - Number(a.value));

  if (!arr.length) return <EmptyCard title={label} />;

  if (arr.length > 6) {
    const head = arr.slice(0, 5);
    const tail = arr.slice(5);
    const sum = tail.reduce((s, x) => s + Number(x.value), 0);
    head.push({ t: 'Lainnya', value: sum, c: 'var(--text-3)' });
    arr = head;
  }

  const sum = arr.reduce((s, x) => s + Number(x.value), 0);
  const total = sum || 1;
  const fmtV = money ? (v: number) => fmtRpShort(v) : (v: number) => fmtNum(v, unit || '');

  const segObjs = arr.map((s) => ({
    value: Number(s.value),
    color: s.c,
    label: s.t,
    disp: fmtV(Number(s.value))
  }));
  const centerObj = center === false ? undefined : { label: centerLabel || 'Total', value: fmtV(sum) };

  return (
    <div className="card">
      <div className="card__title" style={{ textAlign: 'center', marginBottom: 8 }}>
        {label}
      </div>
      <div className="donut">
        <Donut segments={segObjs} center={centerObj} />
        <div className="chart-legend chart-legend--detailed">
          {arr.map((s, i) => {
            const pct = Math.round((Number(s.value) / total) * 100);
            return (
              <span className="legend-item" key={i}>
                <i style={{ background: s.c }} />
                <span className="lg-t">{s.t}</span>
                <span className="lg-v">
                  {fmtV(Number(s.value))} · {pct}%
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
