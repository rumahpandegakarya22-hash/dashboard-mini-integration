

import Donut from '@/components/charts/Donut';
import { EmptyCard, GrpPill, type Grp } from '@/components/charts/ChartCard';
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
  grp?: Grp;
  /** Baris keterangan di bawah donut (mis. total nominal). */
  note?: string;
}

export default function DonutBlock({ label, segs, money, unit, center, centerLabel, grp, note }: DonutBlockProps) {
  let arr = (segs || [])
    .filter((s) => Number(s.value) > 0)
    .slice()
    .sort((a, b) => Number(b.value) - Number(a.value));

  if (!arr.length) return <EmptyCard title={label} grp={grp} />;

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
    <div className={`card${grp ? ` grp-${grp}` : ''}`}>
      <div className="card__title" style={{ textAlign: 'center', marginBottom: 8 }}>
        {label}
        <GrpPill grp={grp} />
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
        {note && <div className="donut__note">{note}</div>}
      </div>
    </div>
  );
}
