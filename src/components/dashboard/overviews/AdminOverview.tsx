
import { StatGrid } from '@/components/ui/StatCard';
import Reveal from '@/components/ui/Reveal';
import ChartCard, { EmptyCard } from '@/components/charts/ChartCard';
import Bars from '@/components/charts/Bars';
import AreaLine from '@/components/charts/AreaLine';
import Table from '@/components/ui/Table';
import DonutBlock from '../DonutBlock';
import { BarStopsGreen } from '../BarStops';
import { PAL } from '@/config/dashboard-palette';
import { COLS } from '@/config/dashboard-cols';
import { fmtRpShort, topEntries, shortAcct } from '@/lib/dashboard/views/finance';
import { monthlyCount, filterByPeriod, moneyScale, scaleVals, parseDate, startOfDay } from '@/lib/dashboard/format';
import type { OverviewProps } from './shared';
import { kartuAdmin, turunanKeuangan } from './kpi-cards';

export default function AdminOverview({ data, finance: F, period, from, to, kpi, range }: OverviewProps) {
  const { penghuni, stats, tempo } = data;
  const hasFin = !!F && F.nBuckets >= 1;

  const moveIn = monthlyCount(filterByPeriod(penghuni, 'masuk', period, from, to), 'masuk');
  const tempoSpark = monthlyCount(filterByPeriod(penghuni, 'tempo', period, from, to), 'tempo');

  // Utamakan data payment.periode_akhir (computeTempo); fallback Sisa Hari tab PENGHUNI.
  const today0 = startOfDay(new Date());
  const sisaOf = (p: (typeof penghuni)[number]) => {
    if (p.sisa != null) return p.sisa;
    const d = parseDate(p.tempo);
    return d ? Math.round((d.getTime() - today0.getTime()) / 86400000) : null;
  };
  const jatuh = tempo
    ? tempo.list
    : penghuni
        .map((p) => ({ p, s: sisaOf(p) }))
        .filter((x) => x.s != null && x.s <= 7)
        .sort((a, b) => (a.s as number) - (b.s as number))
        .map(({ p, s }) => ({
          nama: p.nama,
          name: p.nama,
          wa: p.hp,
          tempo: p.tempo,
          sisa: (s as number) < 0 ? 'Telat ' + -(s as number) + ' hr' : s === 0 ? 'Hari ini' : s + ' hr lagi'
        }));

  const kartu = kartuAdmin(kpi, turunanKeuangan(F, stats.kapasitas, range), {
    aktif: stats.aktif ?? 0,
    kosong: stats.kosong ?? 0,
    jatuhTempo: stats.jatuhTempo ?? 0,
    kapasitas: stats.kapasitas ?? 0,
    pendapatan: F ? F.pendapatanKotor : 0,
    diskon: F ? F.diskonTotal : 0,
    labaBersih: F ? F.labaBersih : 0,
    sparkMasuk: moveIn,
    sparkTempo: tempoSpark,
    sparkPendapatan: F ? F.incSeries : [],
    sparkDiskon: F ? F.diskonSeries : []
  });

  const kontrakDonut = [
    { t: 'Aktif', value: stats.aktif || 0, c: PAL.admin[0] },
    { t: 'Booking', value: stats.booking || 0, c: PAL.admin[1] }
  ];

  const ag = kpi.admin?.aging;
  const agingDonut = ag
    ? [
        { t: '1–7 hari', value: ag.hari1_7, c: '#e0b13a' },
        { t: '8–14 hari', value: ag.hari8_14, c: '#e58a3a' },
        { t: '15–30 hari', value: ag.hari15_30, c: '#d9533a' },
        { t: '> 30 hari', value: ag.lebih30, c: '#8f2a2a' }
      ]
    : [];

  const obars = F ? topEntries(F.opexBy, 4) : [];
  const bsc = obars.length ? moneyScale(Math.max(1, ...obars.map((e) => e[1]))) : null;

  const lsc = hasFin
    ? moneyScale(Math.max(1, ...F!.incSeries, ...F!.expSeries, ...F!.labaSeries.map(Math.abs)))
    : null;
  const U = lsc?.unit ? ' (' + lsc.unit + ')' : '';

  return (
    <div className="view">
      <div className="grp-head grp-admin">Admin</div>
      <StatGrid cards={kartu.admin} cols={6} />
      <Reveal tier={1} className="grid row-2 mt">
        <DonutBlock grp="admin" label="Komposisi Kontrak" segs={kontrakDonut} centerLabel="Total Kontrak" />
        <ChartCard grp="admin" title="Status Kontrak" legend={[{ t: 'Jumlah Kontrak', c: '#3fae84' }]}>
          <Bars
            cats={['Aktif', 'Booking']}
            vals={[stats.aktif || 0, stats.booking || 0]}
            gradId="gAdm1"
            gradStops={<BarStopsGreen />}
          />
        </ChartCard>
      </Reveal>
      <Reveal tier={2} className="mt">
        <Table title="DAFTAR JATUH TEMPO" titleRight cols={COLS.jatuhTempo} data={jatuh} periodLabel={period} />
      </Reveal>

      <div className="grp-head grp-finance">Finance</div>
      <StatGrid cards={kartu.finance} cols={6} />
      <Reveal tier={1} className="grid row-2 mt">
        <DonutBlock
          grp="finance"
          label="Aging Tunggakan"
          segs={agingDonut}
          centerLabel="Penghuni"
          note={ag ? `Estimasi nominal ${fmtRpShort(ag.nominal)}` : undefined}
        />
        {obars.length && bsc ? (
          <ChartCard grp="finance" title="OPEX" legend={[{ t: 'Beban' + (bsc.unit ? ' (' + bsc.unit + ')' : ''), c: '#3fae84' }]}>
            <Bars
              cats={obars.map((e) => shortAcct(e[0]))}
              vals={scaleVals(obars.map((e) => e[1]), bsc)}
              gradId="gAdm2"
              gradStops={<BarStopsGreen />}
              unit={bsc.unit}
            />
          </ChartCard>
        ) : (
          <EmptyCard grp="finance" title="OPEX" />
        )}
      </Reveal>
      <Reveal tier={2} className="mt">
        {hasFin && lsc ? (
          <ChartCard
            grp="finance"
            title="Pendapatan Kotor vs Beban vs Laba Bersih"
            legend={[
              { t: 'Pendapatan Kotor' + U, c: 'var(--teal)' },
              { t: 'Total Beban' + U, c: 'var(--text-2)' },
              { t: 'Laba Bersih' + U, c: '#e0a13a' }
            ]}
          >
            <AreaLine
              seriesList={[
                scaleVals(F!.incSeries, lsc),
                scaleVals(F!.expSeries, lsc),
                scaleVals(F!.labaSeries, lsc)
              ]}
              xLabels={F!.labels}
              names={['Pendapatan Kotor', 'Total Beban', 'Laba Bersih']}
              unit={lsc.unit}
            />
          </ChartCard>
        ) : (
          <EmptyCard grp="finance" title="Pendapatan Kotor vs Beban vs Laba Bersih" />
        )}
      </Reveal>
    </div>
  );
}
