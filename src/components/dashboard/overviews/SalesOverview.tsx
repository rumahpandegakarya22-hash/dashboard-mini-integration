

import { StatGrid } from '@/components/ui/StatCard';
import Reveal from '@/components/ui/Reveal';
import ChartCard, { EmptyCard } from '@/components/charts/ChartCard';
import Bars from '@/components/charts/Bars';
import AreaLine from '@/components/charts/AreaLine';
import Funnel from '@/components/charts/Funnel';
import DataTablePage from '../pages/DataTablePage';
import DonutBlock from '../DonutBlock';
import { BarStopsWarm } from '../BarStops';
import { PAL } from '@/config/dashboard-palette';
import { COLS } from '@/config/dashboard-cols';
import { seriesByDate } from '@/lib/dashboard/views/finance';
import { buildProspek } from '@/lib/dashboard/views/prospek';
import { monthlyCount } from '@/lib/dashboard/format';
import type { OverviewProps } from './shared';
import { kartuSales } from './kpi-cards';

export default function SalesOverview({ data, period, range, kpi }: OverviewProps) {
  const { booking, leads, survey, stats, retention } = data;
  const prospek = buildProspek(leads, survey, booking);

  const allBooking = booking || [];
  const nLeads = leads.length;
  const nSurvey = survey.length;
  const nBooking = allBooking.length;
  const nCancel = allBooking.filter((x) => /batal|cancel/i.test(x.status || '')).length;
  const cancelRate = nBooking ? Math.round((nCancel / nBooking) * 100) : 0;

  const bookSpark = monthlyCount(allBooking, 'tanggal');
  const survSpark = monthlyCount(survey, 'tanggal');

  // Rata-rata lama sewa: lama tinggal aktual dari Historical Customer (keluar − masuk)
  const kartu = kartuSales(kpi, {
    survey: nSurvey,
    booking: nBooking,
    cancelRate,
    avgTenure: retention?.avgTenure ?? null,
    okupansi: stats.okupansi ?? 0,
    sparkSurvey: survSpark,
    sparkBooking: bookSpark
  });

  const prospekDonut = [
    { t: 'Leads', value: nLeads, c: PAL.sales[0] },
    { t: 'Booking', value: nBooking, c: PAL.sales[1] },
    { t: 'Cancel', value: nCancel, c: PAL.sales[2] }
  ];
  const checkin = stats.occupied || 0;

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
      <StatGrid cards={kartu.baris1} cols={5} />
      <div className="mt">
        <StatGrid cards={kartu.baris2} cols={6} />
      </div>

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
              { t: 'Check-in', c: '#d8c8b0' }
            ]}
          >
            <div className="funnel-wrap">
              <Funnel
                stages={[
                  { value: nLeads || 1 },
                  { value: nSurvey || 1 },
                  { value: nBooking || 1 },
                  { value: checkin || 1 }
                ]}
              />
              <div className="funnel-stats">
                <div><span>Leads</span><b>{nLeads}</b></div>
                <div><span>Survey</span><b>{nSurvey}</b></div>
                <div><span>Booking</span><b>{nBooking}</b></div>
                <div><span>Check-in</span><b>{checkin}</b></div>
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

      <Reveal tier={3} className="mt-lg">
        <DataTablePage title="DAFTAR PROSPEK" cols={COLS.prospek} data={prospek} period={period} />
      </Reveal>
    </div>
  );
}
