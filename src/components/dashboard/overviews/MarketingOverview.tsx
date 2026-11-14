

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
import { monthlyCount, filterByPeriod, fmtNum } from '@/lib/dashboard/format';
import type { OverviewProps } from './shared';
import { kartuMarketing } from './kpi-cards';

export default function MarketingOverview({ data, period, from, to, range, kpi }: OverviewProps) {
  const { leads, survey } = data;

  const leadsP = filterByPeriod(leads, 'tanggal', period, from, to);
  const nLeads = leadsP.length;
  const leadSpark = monthlyCount(leadsP, 'tanggal');

  // Funnel konten: View -> Action (like + komentar + share) -> Leads. Bentuk pakai skala log
  // karena View ribuan dan Leads puluhan; angka asli tetap tampil di samping.
  const view = kpi.marketing?.view ?? 0;
  const aksi = kpi.marketing?.aksi ?? 0;
  const leadsFunnel = kpi.marketing?.leads ?? nLeads;
  const bentuk = (v: number) => Math.log10(v + 1) + 0.15;
  const rasio = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  const kartu = kartuMarketing(kpi, leadSpark);

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
      { name: 'Leads', rows: leads, dateKey: 'tanggal' }
    ],
    range
  );

  return (
    <div className="view">
      <StatGrid cards={kartu.baris1} cols={4} />
      <div className="mt">
        <StatGrid cards={kartu.baris2} cols={3} />
      </div>

      <Reveal tier={1} className="grid row-2 mt">
        {ts ? (
          <ChartCard
            title="Tren Leads"
            legend={[{ t: 'Leads', c: 'var(--teal)' }]}
          >
            <AreaLine seriesList={ts.seriesList} xLabels={ts.labels} names={ts.names} gradId="lcMk" />
          </ChartCard>
        ) : (
          <EmptyCard title="Tren Leads" />
        )}
        <DonutBlock label="Komposisi Leads Channel" segs={channelDonut} />
      </Reveal>

      <Reveal tier={2} className="grid row-2 mt">
        {view || aksi || leadsFunnel ? (
          <ChartCard
            title="Funnel Konten"
            legend={[{ t: 'View', c: '#7a6f63' }, { t: 'Action', c: '#9a8a78' }, { t: 'Leads', c: '#b8a890' }]}
          >
            <div className="funnel-wrap">
              <Funnel
                stages={[
                  { label: 'View', value: view, shape: bentuk(view) },
                  { label: 'Action', value: aksi, shape: bentuk(aksi) },
                  { label: 'Leads', value: leadsFunnel, shape: bentuk(leadsFunnel) }
                ]}
              />
              <div className="funnel-stats">
                <div>
                  <span>View (jangkauan)</span>
                  <b>{fmtNum(view, '')}</b>
                </div>
                <div>
                  <span>Action (like, komentar, share)</span>
                  <b>
                    {fmtNum(aksi, '')} <small>· {rasio(aksi, view)} % dari View</small>
                  </b>
                </div>
                <div>
                  <span>Leads</span>
                  <b>
                    {fmtNum(leadsFunnel, '')} <small>· {rasio(leadsFunnel, aksi)} % dari Action</small>
                  </b>
                </div>
              </div>
            </div>
          </ChartCard>
        ) : (
          <EmptyCard title="Funnel Konten" />
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
        <DataTablePage title="DAFTAR FOLLOW UP" cols={COLS.leads} data={leadsP.slice(0, 4)} period={period} />
      </Reveal>
    </div>
  );
}
