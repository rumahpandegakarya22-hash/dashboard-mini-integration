/* PORT VERBATIM dari `marketingOverview()` public/app.js (Fase 4 langkah 4).
   CAC tetap "—" seperti di sumber: belum ada data biaya marketing. */

import { StatGrid, type StatCardData } from '@/components/ui/StatCard';
import Reveal from '@/components/ui/Reveal';
import ChartCard, { EmptyCard } from '@/components/charts/ChartCard';
import Bars from '@/components/charts/Bars';
import AreaLine from '@/components/charts/AreaLine';
import Funnel from '@/components/charts/Funnel';
import Table from '@/components/ui/Table';
import DonutBlock from '../DonutBlock';
import { BarStopsWarm } from '../BarStops';
import { G, PAL } from '@/config/dashboard-palette';
import { COLS } from '@/config/dashboard-cols';
import { seriesByDate } from '@/lib/dashboard/views/finance';
import { monthlyCount, filterByPeriod } from '@/lib/dashboard/format';
import type { OverviewProps } from './shared';

export default function MarketingOverview({ data, period, from, to, range }: OverviewProps) {
  const { leads, survey, penghuni, stats } = data;

  const leadsP = filterByPeriod(leads, 'tanggal', period, from, to);
  const surveyP = filterByPeriod(survey, 'tanggal', period, from, to);
  const nLeads = leadsP.length;
  const nSurvey = surveyP.length;
  const konv = nLeads ? Math.round((nSurvey / nLeads) * 100) : 0;

  const leadSpark = monthlyCount(leadsP, 'tanggal');
  const survSpark = monthlyCount(surveyP, 'tanggal');
  const moveIn = monthlyCount(filterByPeriod(penghuni, 'masuk', period, from, to), 'masuk');

  const cards: StatCardData[] = [
    { label: 'Leads', value: String(nLeads), spark: leadSpark, bg: G.mkLeads },
    { label: 'Survey', value: String(nSurvey), spark: survSpark, bg: G.mkSurvey, onDark: true },
    { label: 'Konversi Leads-Survey', value: konv + ' %', spark: survSpark, bg: G.mkConv },
    { label: 'Unit Tersewa', value: String(stats.occupied ?? 0), spark: moveIn, bg: G.mkUnit },
    // butuh data biaya marketing → belum ada
    { label: 'CAC', value: '—', spark: leadSpark, bg: G.mkCac }
  ];

  // Komposisi channel dari kolom Asal/Sumber leads (periode)
  const chMap: Record<string, number> = {};
  leadsP.forEach((l) => {
    const a = l.asal || 'Lainnya';
    chMap[a] = (chMap[a] || 0) + 1;
  });
  const chTop = Object.entries(chMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const channelDonut = chTop.map((e, i) => ({ t: e[0], value: e[1], c: PAL.marketing[i % 4] }));

  const ts = seriesByDate(
    [
      { name: 'Leads', rows: leads, dateKey: 'tanggal' },
      { name: 'Survey', rows: survey, dateKey: 'tanggal' }
    ],
    range
  );

  return (
    <div className="view">
      <StatGrid cards={cards} cols={5} />

      <Reveal tier={1} className="grid row-2 mt">
        {ts ? (
          <ChartCard
            title="Tren Leads & Survey"
            legend={[{ t: 'Leads', c: 'var(--teal)' }, { t: 'Survey', c: 'var(--text-2)' }]}
          >
            <AreaLine seriesList={ts.seriesList} xLabels={ts.labels} names={ts.names} gradId="lcMk" />
          </ChartCard>
        ) : (
          <EmptyCard title="Tren Leads & Survey" />
        )}
        <DonutBlock label="Komposisi Leads Channel" segs={channelDonut} />
      </Reveal>

      <Reveal tier={2} className="grid row-2 mt">
        {nLeads || nSurvey ? (
          <ChartCard
            title="Funnel Penjualan"
            legend={[{ t: 'Leads', c: '#9a8a78' }, { t: 'Survey', c: '#d8c8b0' }]}
          >
            <div className="funnel-wrap">
              <Funnel
                stages={[
                  { value: nLeads || 1 },
                  { value: nSurvey || 1 },
                  { value: Math.max(1, Math.round(nSurvey * 0.6)) }
                ]}
              />
              <div className="funnel-stats">
                <div>
                  <span>Leads masuk</span>
                  <b>{nLeads}</b>
                </div>
                <div>
                  <span>Survey / Viewing</span>
                  <b>{nSurvey}</b>
                </div>
              </div>
            </div>
          </ChartCard>
        ) : (
          <EmptyCard title="Funnel Penjualan" />
        )}

        {chTop.length ? (
          <ChartCard title="Leads Channel" legend={[{ t: 'Jumlah Leads', c: '#e26d6d' }]}>
            <Bars
              cats={chTop.map((e) => e[0])}
              vals={chTop.map((e) => e[1])}
              gradId="gMk1"
              gradStops={<BarStopsWarm />}
            />
          </ChartCard>
        ) : (
          <EmptyCard title="Leads Channel" />
        )}
      </Reveal>

      <Reveal tier={3}>
        <Table title="DAFTAR FOLLOW UP" cols={COLS.leads} data={leadsP.slice(0, 4)} periodLabel={period} />
      </Reveal>
    </div>
  );
}
