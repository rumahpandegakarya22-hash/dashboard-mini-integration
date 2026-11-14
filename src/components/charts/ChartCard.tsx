
export interface LegendItem {
  /** warna */
  c: string;
  /** teks */
  t: string;
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="chart-legend">
      {items.map((i, k) => (
        <span className="legend-item" key={k}>
          <i style={{ background: i.c }} />
          {i.t}
        </span>
      ))}
    </div>
  );
}

/** Empty-state: placeholder, BUKAN data dummy, saat periode tak punya data. */
export function EmptyChart({ msg }: { msg?: string }) {
  return <div className="chart-empty">{msg || 'Tidak ada data pada periode ini'}</div>;
}

export type Grp = 'admin' | 'finance';

/** Pill penanda kelompok kerja (Admin / Finance) di judul kartu. */
export function GrpPill({ grp }: { grp?: Grp }) {
  return grp ? <i className="grp-pill">{grp === 'admin' ? 'Admin' : 'Finance'}</i> : null;
}

export function EmptyCard({ title, msg, grp }: { title: string; msg?: string; grp?: Grp }) {
  return (
    <div className={`card${grp ? ` grp-${grp}` : ''}`}>
      <div className="card__title">{title}<GrpPill grp={grp} /></div>
      <EmptyChart msg={msg} />
    </div>
  );
}

export default function ChartCard({
  title,
  legend,
  children,
  grp
}: {
  title: React.ReactNode;
  legend?: LegendItem[];
  children: React.ReactNode;
  grp?: Grp;
}) {
  return (
    <div className={`card${grp ? ` grp-${grp}` : ''}`}>
      <div className="card__title">{title}<GrpPill grp={grp} /></div>
      {children}
      {legend && <ChartLegend items={legend} />}
    </div>
  );
}
