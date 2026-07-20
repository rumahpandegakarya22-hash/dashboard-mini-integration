/* PORT dari `chartCard()` / `chartLegend()` / `emptyChart()` / `emptyCard()`
   public/app.js (Fase 4). Markup & nama kelas dipertahankan agar CSS ter-port
   berlaku tanpa perubahan. */

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

export function EmptyCard({ title, msg }: { title: string; msg?: string }) {
  return (
    <div className="card">
      <div className="card__title">{title}</div>
      <EmptyChart msg={msg} />
    </div>
  );
}

export default function ChartCard({
  title,
  legend,
  children
}: {
  title: React.ReactNode;
  legend?: LegendItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card__title">{title}</div>
      {children}
      {legend && <ChartLegend items={legend} />}
    </div>
  );
}
