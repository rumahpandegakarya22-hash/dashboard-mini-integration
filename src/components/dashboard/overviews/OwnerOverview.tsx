/* PORT VERBATIM dari `ownerOverview()` public/app.js (Fase 4 langkah 4).
   Keuangan dihitung ULANG untuk periode yang dipilih, jadi scorecard, line, dan
   donut ikut berubah saat filter periode diganti. */

import { StatGrid, type StatCardData } from '@/components/ui/StatCard';
import Reveal from '@/components/ui/Reveal';
import ChartCard, { EmptyCard } from '@/components/charts/ChartCard';
import Bars from '@/components/charts/Bars';
import AreaLine from '@/components/charts/AreaLine';
import DonutBlock from '../DonutBlock';
import { BarStopsOwner } from '../BarStops';
import { G, PAL, OWN_BAR } from '@/config/dashboard-palette';
import { fmtRpShort, topEntries, shortAcct } from '@/lib/dashboard/views/finance';
import { monthlyCount, filterByPeriod, moneyScale, scaleVals } from '@/lib/dashboard/format';
import type { OverviewProps } from './shared';

export default function OwnerOverview({ data, finance: F, period, from, to }: OverviewProps) {
  const { penghuni, stats, rooms } = data;
  const hasFin = !!F && F.nBuckets >= 1;
  const moveIn = monthlyCount(filterByPeriod(penghuni, 'masuk', period, from, to), 'masuk');

  const cards: StatCardData[] = [
    { label: 'Pendapatan Kotor', value: fmtRpShort(F ? F.pendapatanKotor : 0), spark: F ? F.cashSeries : [], bg: G.ownPrimary, onDark: true },
    { label: 'Laba Bersih', value: fmtRpShort(F ? F.labaBersih : 0), spark: F ? F.labaSeries : [], bg: G.ownPrimary, onDark: true },
    { label: 'Okupansi', value: (stats.okupansi ?? 0) + ' %', spark: moveIn, bg: G.ownRose, onDark: true },
    { label: 'OPEX', value: fmtRpShort(F ? F.beban : 0), spark: F ? F.expSeries : [], bg: G.ownGray, onDark: true },
    { label: 'Kamar Kosong', value: String(stats.kosong ?? 0), spark: moveIn, bg: G.ownGray, onDark: true },
    { label: 'Kamar Isi', value: String(stats.occupied ?? 0), spark: moveIn, bg: G.ownRose, onDark: true }
  ];

  const opex = F ? topEntries(F.opexBy, 6).map((e, i) => ({ t: shortAcct(e[0]), value: e[1], c: PAL.owner[i % 4] })) : [];
  const income = F ? topEntries(F.incomeBy, 6).map((e, i) => ({ t: shortAcct(e[0]), value: e[1], c: PAL.owner[i % 4] })) : [];

  // Komposisi status KAMAR dari ROOMS (master 29 kamar), bukan jumlah penghuni.
  const roomCnt = (s: string) => rooms.filter((r) => r.status === s).length;
  const kamar = [
    { t: 'Terisi', value: roomCnt('Terisi'), c: PAL.owner[0] },
    { t: 'Booking', value: roomCnt('Booking'), c: PAL.owner[1] },
    { t: 'Kosong', value: roomCnt('Kosong'), c: PAL.owner[2] }
  ];
  const nMaint = roomCnt('Maintenance');
  if (nMaint) kamar.push({ t: 'Maintenance', value: nMaint, c: PAL.owner[3] });

  const lsc = hasFin
    ? moneyScale(Math.max(1, ...F!.cashSeries, ...F!.expSeries, ...F!.labaSeries.map(Math.abs)))
    : null;
  const U = lsc?.unit ? ' (' + lsc.unit + ')' : '';

  const obars = F ? topEntries(F.opexBy, 5) : [];
  const bsc = obars.length ? moneyScale(Math.max(1, ...obars.map((e) => e[1]))) : null;

  return (
    <div className="view">
      <StatGrid cards={cards} cols={6} />

      <Reveal tier={1} className="grid row-2 mt">
        {hasFin && lsc ? (
          <ChartCard
            title="Pendapatan Kotor vs Beban Operasional vs Laba Bersih"
            legend={[
              { t: 'Pendapatan Kotor' + U, c: 'var(--teal)' },
              { t: 'Beban Operasional' + U, c: 'var(--text-2)' },
              { t: 'Laba Bersih' + U, c: '#e0a13a' }
            ]}
          >
            <AreaLine
              seriesList={[scaleVals(F!.cashSeries, lsc), scaleVals(F!.expSeries, lsc), scaleVals(F!.labaSeries, lsc)]}
              xLabels={F!.labels}
              names={['Pendapatan Kotor', 'Beban Operasional', 'Laba Bersih']}
              unit={lsc.unit}
            />
          </ChartCard>
        ) : (
          <EmptyCard title="Pendapatan Kotor vs Beban Operasional vs Laba Bersih" />
        )}

        {obars.length && bsc ? (
          <ChartCard title="Beban Operasional" legend={[{ t: 'Beban' + (bsc.unit ? ' (' + bsc.unit + ')' : ''), c: OWN_BAR }]}>
            <Bars
              cats={obars.map((e) => shortAcct(e[0]))}
              vals={scaleVals(obars.map((e) => e[1]), bsc)}
              gradId="gOwn1"
              gradStops={<BarStopsOwner />}
              unit={bsc.unit}
            />
          </ChartCard>
        ) : (
          <EmptyCard title="Beban Operasional" />
        )}
      </Reveal>

      <Reveal tier={2} className="grid row-3 mt">
        <DonutBlock label="Komposisi OPEX" segs={opex} money centerLabel="Total OPEX" />
        <DonutBlock label="Komposisi Income" segs={income} money centerLabel="Total Income" />
        <DonutBlock label="Komposisi Status Kamar" segs={kamar} centerLabel="Total Kamar" />
      </Reveal>
    </div>
  );
}
