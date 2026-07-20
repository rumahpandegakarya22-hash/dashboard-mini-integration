/* PORT VERBATIM dari `adminOverview()` public/app.js (Fase 4 langkah 4).

   Catatan port: fallback "Sisa Hari dari tab PENGHUNI" untuk Daftar Jatuh Tempo
   DIPERTAHANKAN — itu bukan data demo, melainkan jalur cadangan sah ketika tabel
   `payment` belum terhidrasi. Yang tidak ikut di-port hanyalah pembangkit baris
   fiktif (lihat docs/MIGRASI.md §4.7). */

import { StatGrid, type StatCardData } from '@/components/ui/StatCard';
import ChartCard, { EmptyCard } from '@/components/charts/ChartCard';
import Bars from '@/components/charts/Bars';
import AreaLine from '@/components/charts/AreaLine';
import Table from '@/components/ui/Table';
import DonutBlock from '../DonutBlock';
import { BarStopsGreen } from '../BarStops';
import { G, PAL } from '@/config/dashboard-palette';
import { COLS } from '@/config/dashboard-cols';
import { fmtRpShort, topEntries, shortAcct } from '@/lib/dashboard/views/finance';
import { monthlyCount, filterByPeriod, moneyScale, scaleVals, parseDate, startOfDay } from '@/lib/dashboard/format';
import type { OverviewProps } from './shared';

export default function AdminOverview({ data, finance: F, period, from, to }: OverviewProps) {
  const { penghuni, stats, tempo } = data;
  const hasFin = !!F && F.nBuckets >= 1;

  const moveIn = monthlyCount(filterByPeriod(penghuni, 'masuk', period, from, to), 'masuk');
  const tempoSpark = monthlyCount(filterByPeriod(penghuni, 'tempo', period, from, to), 'tempo');

  const cards: StatCardData[] = [
    { label: 'Pendapatan', value: fmtRpShort(F ? F.pendapatanKotor : 0), spark: F ? F.cashSeries : [], bg: G.adminGreen },
    { label: 'Kontrak Aktif', value: String(stats.aktif ?? 0), spark: moveIn, bg: G.adminCyan },
    { label: 'Kamar Kosong', value: String(stats.kosong ?? 0), spark: moveIn, bg: G.adminOlive, onDark: true },
    { label: 'Tunggakan', value: String(stats.tunggakan ?? 0), spark: tempoSpark, bg: G.adminDarkO, onDark: true },
    { label: 'Jatuh Tempo', value: String(stats.jatuhTempo ?? 0), spark: tempoSpark, bg: G.adminDarkG, onDark: true }
  ];

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

  const kontrakDonut = [
    { t: 'Aktif', value: stats.aktif || 0, c: PAL.admin[0] },
    { t: 'Booking', value: stats.booking || 0, c: PAL.admin[1] }
  ];

  const obars = F ? topEntries(F.opexBy, 4) : [];
  const bsc = obars.length ? moneyScale(Math.max(1, ...obars.map((e) => e[1]))) : null;

  const lsc = hasFin
    ? moneyScale(Math.max(1, ...F!.cashSeries, ...F!.expSeries, ...F!.labaSeries.map(Math.abs)))
    : null;
  const U = lsc?.unit ? ' (' + lsc.unit + ')' : '';

  return (
    <div className="view">
      <StatGrid cards={cards} cols={5} />

      <div className="grid row-3 mt">
        <DonutBlock label="Komposisi Kontrak" segs={kontrakDonut} centerLabel="Total Kontrak" />
        <ChartCard title="Status Kontrak" legend={[{ t: 'Jumlah Kontrak', c: '#3fae84' }]}>
          <Bars
            cats={['Aktif', 'Booking']}
            vals={[stats.aktif || 0, stats.booking || 0]}
            gradId="gAdm1"
            gradStops={<BarStopsGreen />}
          />
        </ChartCard>
        {obars.length && bsc ? (
          <ChartCard title="OPEX" legend={[{ t: 'Beban' + (bsc.unit ? ' (' + bsc.unit + ')' : ''), c: '#3fae84' }]}>
            <Bars
              cats={obars.map((e) => shortAcct(e[0]))}
              vals={scaleVals(obars.map((e) => e[1]), bsc)}
              gradId="gAdm2"
              gradStops={<BarStopsGreen />}
              unit={bsc.unit}
            />
          </ChartCard>
        ) : (
          <EmptyCard title="OPEX" />
        )}
      </div>

      <div className="grid row-2-3 mt">
        {hasFin && lsc ? (
          <ChartCard
            title="Pendapatan Kotor vs Beban vs Laba Bersih"
            legend={[
              { t: 'Pendapatan Kotor' + U, c: 'var(--teal)' },
              { t: 'Beban Operasional' + U, c: 'var(--text-2)' },
              { t: 'Laba Bersih' + U, c: '#e0a13a' }
            ]}
          >
            <AreaLine
              seriesList={[
                scaleVals(F!.cashSeries, lsc),
                scaleVals(F!.expSeries, lsc),
                scaleVals(F!.labaSeries, lsc)
              ]}
              xLabels={F!.labels}
              names={['Pendapatan Kotor', 'Beban Operasional', 'Laba Bersih']}
              unit={lsc.unit}
            />
          </ChartCard>
        ) : (
          <EmptyCard title="Pendapatan Kotor vs Beban vs Laba Bersih" />
        )}

        <Table title="DAFTAR JATUH TEMPO" titleRight cols={COLS.jatuhTempo} data={jatuh} periodLabel={period} />
      </div>
    </div>
  );
}
