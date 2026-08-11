

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
import { monthlyCount } from '@/lib/dashboard/format';
import type { OverviewProps } from './shared';

export default function SalesOverview({ data, period, range }: OverviewProps) {
  const { booking, leads, survey, stats, retention } = data;

  const allBooking = booking || [];
  const nLeads = leads.length;
  const nSurvey = survey.length;
  const nBooking = allBooking.length;
  const nCancel = allBooking.filter((x) => /batal|cancel/i.test(x.status || '')).length;
  const cancelRate = nBooking ? Math.round((nCancel / nBooking) * 100) : 0;
  const convRate = nLeads ? ((nBooking / nLeads) * 100).toFixed(1).replace('.', ',') : '0';

  // AVG Durasi Sewa: lama tinggal aktual dari Historical Customer (keluar − masuk)
  const avgDurTxt = retention && retention.avgTenure != null ? retention.avgTenure + ' bln' : '—';

  const bookSpark = monthlyCount(allBooking, 'tanggal');
  const survSpark = monthlyCount(survey, 'tanggal');

  const cards: StatCardData[] = [
    { label: 'Booking', value: String(nBooking), spark: bookSpark, bg: G.salePink },
    { label: 'Cancellation Rate', value: cancelRate + ' %', spark: bookSpark, bg: G.saleRed },
    { label: 'Conversion Rate', value: convRate + ' %', spark: survSpark, bg: G.saleGold },
    { label: 'Retention Rate', value: retention ? retention.rate + ' %' : '—', spark: [], bg: G.salePeach },
    { label: 'Rata-Rata Sewa', value: avgDurTxt, spark: [], bg: G.salePink },
    { label: 'Kamar Isi', value: String(stats.occupied ?? 0), spark: [], bg: G.saleGold }
  ];

  const prospekDonut = [
    { t: 'Leads', value: nLeads, c: PAL.sales[0] },
    { t: 'Booking', value: nBooking, c: PAL.sales[1] },
    { t: 'Cancel', value: nCancel, c: PAL.sales[2] }
  ];
  const kontrak = stats.occupied || 0;

  const ts = seriesByDate(
    [
      { name: 'Booking', rows: allBooking, dateKey: 'tanggal' },
      { name: 'Survey', rows: survey, dateKey: 'tanggal' }
    ],
    range
  );

  // Kategori prospek dari kolom Asal survey (agregat, tanpa periode)
  const spMap: Record<string, number> = {};
  survey.forEach((s) => {
    const a = s.asal || 'Lainnya';
    spMap[a] = (spMap[a] || 0) + 1;
  });
  const spTop = Object.entries(spMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="view">
      <StatGrid cards={cards} cols={6} />

      <Reveal tier={1} className="grid row-2 mt">
        {ts ? (
          <ChartCard
            title="Tren Booking & Survey"
            legend={[{ t: 'Booking', c: 'var(--teal)' }, { t: 'Survey', c: 'var(--text-2)' }]}
          >
            <AreaLine seriesList={ts.seriesList} xLabels={ts.labels} names={ts.names} gradId="lcSale" />
          </ChartCard>
        ) : (
          <EmptyCard title="Tren Booking & Survey" />
        )}
        <DonutBlock label="Komposisi Prospek" segs={prospekDonut} />
      </Reveal>

      <Reveal tier={2} className="grid row-2 mt">
        {nLeads || nSurvey || nBooking ? (
          <ChartCard
            title="Funnel Penjualan"
            legend={[
              { t: 'Leads', c: '#7a6f63' },
              { t: 'Survey', c: '#9a8a78' },
              { t: 'Booking', c: '#b8a890' },
              { t: 'Kontrak', c: '#d8c8b0' }
            ]}
          >
            <div className="funnel-wrap">
              <Funnel
                stages={[
                  { value: nLeads || 1 },
                  { value: nSurvey || 1 },
                  { value: nBooking || 1 },
                  { value: kontrak || 1 }
                ]}
              />
              <div className="funnel-stats">
                <div><span>Leads</span><b>{nLeads}</b></div>
                <div><span>Survey</span><b>{nSurvey}</b></div>
                <div><span>Booking</span><b>{nBooking}</b></div>
                <div><span>Kontrak</span><b>{kontrak}</b></div>
              </div>
            </div>
          </ChartCard>
        ) : (
          <EmptyCard title="Funnel Penjualan" />
        )}

        {spTop.length ? (
          <ChartCard title="Kategori Prospek" legend={[{ t: 'Jumlah Prospek', c: '#e58a6f' }]}>
            <Bars
              cats={spTop.map((e) => e[0])}
              vals={spTop.map((e) => e[1])}
              gradId="gSale1"
              gradStops={<BarStopsWarm />}
            />
          </ChartCard>
        ) : (
          <EmptyCard title="Kategori Prospek" />
        )}
      </Reveal>

      <Reveal tier={3}>
        <Table title="DAFTAR PROSPEK" cols={COLS.prospek} data={survey} periodLabel={period} />
      </Reveal>
    </div>
  );
}
