/* PORT VERBATIM dari `opsOverview()` public/app.js (Fase 4 langkah 4).

   Response Time (jam) = Tgl Lapor − Tgl Kerusakan; Resolution Time (hari) =
   Tgl Selesai − Tgl Kerusakan. Keduanya dihitung per tiket saat hidrasi
   (_respJam/_resolHari); di sini dirata-ratakan pada periode. Bila tak ada
   sumbernya, nilainya "—" — BUKAN angka dummy. */

import { StatGrid, StatCard, type StatCardData } from '@/components/ui/StatCard';
import Reveal from '@/components/ui/Reveal';
import ChartCard, { EmptyCard } from '@/components/charts/ChartCard';
import Bars from '@/components/charts/Bars';
import AreaLine from '@/components/charts/AreaLine';
import Table from '@/components/ui/Table';
import DonutBlock from '../DonutBlock';
import { BarStopsWarm } from '../BarStops';
import { G, PAL } from '@/config/dashboard-palette';
import { COLS } from '@/config/dashboard-cols';
import { fmtRpShort, topEntries, shortAcct, seriesByDate } from '@/lib/dashboard/views/finance';
import { monthlyCount, filterByPeriod, moneyScale, scaleVals } from '@/lib/dashboard/format';
import type { OverviewProps } from './shared';

export default function OpsOverview({ data, finance: F, period, from, to, range }: OverviewProps) {
  const { tiket, logbook } = data;

  const tP = filterByPeriod(tiket || [], 'tanggal', period, from, to);
  const nPrev = tP.filter((x) => x.jenis === 'Preventif').length;
  const nKor = tP.filter((x) => x.jenis === 'Korektif').length;
  const totalTiket = nPrev + nKor;
  const cost = tP.reduce((s, x) => s + (x._biaya || 0), 0);
  const defect = totalTiket ? Math.round((nKor / totalTiket) * 100) : 0;

  const tikSpark = monthlyCount(tP, 'tanggal');
  const korSpark = monthlyCount(tP.filter((x) => x.jenis === 'Korektif'), 'tanggal');
  const prevSpark = monthlyCount(tP.filter((x) => x.jenis === 'Preventif'), 'tanggal');

  const top: StatCardData[] = [
    { label: 'Tiket Preventif', value: String(nPrev), spark: prevSpark, bg: G.opRed, onDark: true },
    { label: 'Tiket Korektif', value: String(nKor), spark: korSpark, bg: G.opOrange, onDark: true },
    { label: 'Defect Rate', value: defect + ' %', spark: korSpark, bg: G.opTeal },
    { label: 'Total Tiket', value: String(totalTiket), spark: tikSpark, bg: G.opAmber },
    { label: 'Biaya Perbaikan', value: fmtRpShort(cost), spark: tikSpark, bg: G.opGreen }
  ];

  const respArr = tP.map((x) => x._respJam).filter((v): v is number => v != null);
  const resolArr = tP.map((x) => x._resolHari).filter((v): v is number => v != null);
  const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  const fmtDur = (n: number) => (Math.round(n * 10) / 10).toLocaleString('id-ID');
  const avgResp = avg(respArr);
  const avgResol = avg(resolArr);

  const mid: StatCardData[] = [
    { label: 'Response Time', value: avgResp != null ? fmtDur(avgResp) + ' jam' : '—', spark: respArr, bg: G.opOrange, onDark: true },
    { label: 'Resolution Time', value: avgResol != null ? fmtDur(avgResol) + ' hari' : '—', spark: resolArr, bg: G.opRed, onDark: true }
  ];

  const nInspeksi = filterByPeriod(logbook, 'tanggal', period, from, to).filter((r) => r.divisi === 'Inspeksi').length;
  const tiketDonut = [
    { t: 'Preventif', value: nPrev, c: PAL.operasional[0] },
    { t: 'Korektif', value: nKor, c: PAL.operasional[1] },
    { t: 'Inspeksi', value: nInspeksi, c: PAL.operasional[2] }
  ];

  const ebars = F ? topEntries(F.opexBy, 4) : [];
  const es = ebars.length ? moneyScale(Math.max(1, ...ebars.map((e) => e[1]))) : null;

  const ts = seriesByDate(
    [
      { name: 'Preventif', rows: (tiket || []).filter((x) => x.jenis === 'Preventif'), dateKey: 'tanggal' },
      { name: 'Korektif', rows: (tiket || []).filter((x) => x.jenis === 'Korektif'), dateKey: 'tanggal' }
    ],
    range
  );

  return (
    <div className="view">
      <StatGrid cards={top} cols={5} />

      <Reveal tier={1} className="grid row-3 mt" style={{ gridTemplateColumns: 'minmax(0,1.4fr) repeat(2,minmax(0,1fr))' }}>
        {ebars.length && es ? (
          <ChartCard title="Expense Category" legend={[{ t: 'Beban' + (es.unit ? ' (' + es.unit + ')' : ''), c: '#e58a6f' }]}>
            <Bars
              cats={ebars.map((e) => shortAcct(e[0]))}
              vals={scaleVals(ebars.map((e) => e[1]), es)}
              gradId="gOp1"
              gradStops={<BarStopsWarm />}
              unit={es.unit}
            />
          </ChartCard>
        ) : (
          <EmptyCard title="Expense Category" />
        )}
        <StatCard {...mid[0]} />
        <StatCard {...mid[1]} />
      </Reveal>

      <Reveal tier={2} className="grid row-2 mt">
        {ts ? (
          <ChartCard
            title="Tren Tiket Maintenance"
            legend={[{ t: 'Preventif', c: 'var(--teal)' }, { t: 'Korektif', c: 'var(--text-2)' }]}
          >
            <AreaLine seriesList={ts.seriesList} xLabels={ts.labels} names={ts.names} gradId="lcOp" />
          </ChartCard>
        ) : (
          <EmptyCard title="Tren Tiket Maintenance" />
        )}
        <DonutBlock label="Komposisi Kategori Tiket" segs={tiketDonut} />
      </Reveal>

      <Reveal tier={3}>
        <Table title="STATUS TIKET" cols={COLS.tiket} data={tiket || []} periodLabel={period} />
      </Reveal>
    </div>
  );
}
