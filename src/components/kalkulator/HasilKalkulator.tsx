'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import ChartCard from '@/components/charts/ChartCard';
import Bars from '@/components/charts/Bars';
import DonutBlock from '@/components/dashboard/DonutBlock';
import { BarStopsOwner } from '@/components/dashboard/BarStops';
import { glassify } from '@/components/ui/StatCard';
import { G, PAL } from '@/config/dashboard-palette';
import GrafikSensitivitas from './GrafikSensitivitas';
import { bulan, persen, rp, rpRingkas } from '@/lib/kalkulator/format';
import type { HasilHitung } from '@/lib/kalkulator/tipe';

interface Kartu {
  label: string;
  nilai: string;
  sub?: string;
  bg: string;
}

/** Kartu ala StatCard tanpa animasi hitung-dari-nol, karena nilainya berubah setiap slider digeser. */
function KartuHasil({ label, nilai, sub, bg }: Kartu) {
  return (
    <article className="stat-card on-dark" style={{ background: glassify(bg, 0.58), position: 'relative' }}>
      <span className="stat-card__head">
        <span className="stat-card__label">{label}</span>
      </span>
      <span className="stat-card__value">{nilai}</span>
      {sub && <span className="stat-card__sub">{sub}</span>}
    </article>
  );
}

const teksBep = (h: HasilHitung) => (h.bep === null ? 'Tidak tercapai' : `${h.bep} kamar`);

/**
 * Bilah ringkas melayang di bawah layar, muncul hanya saat kartu hasil tidak terlihat (mis. di HP ketika
 * menggeser input). Di-portal ke wrapper [data-app] karena leluhur di dalam .app memakai transform/overflow
 * yang membuat sticky/fixed tidak bekerja.
 */
export function RingkasHasil({ h }: { h: HasilHitung }) {
  const [tampil, setTampil] = useState(false);
  const [wadah, setWadah] = useState<Element | null>(null);

  useEffect(() => {
    setWadah(document.querySelector('[data-app="dashboard"]'));
    const target = document.querySelector('.kalk-hasil .stat-grid');
    if (!target) return;
    const io = new IntersectionObserver(([e]) => setTampil(!e.isIntersecting));
    io.observe(target);
    return () => io.disconnect();
  }, []);

  if (!wadah || !tampil) return null;
  return createPortal(
    <div className="kalk-ringkas" role="status">
      <span>
        Laba/bln <b className={h.labaBersih < 0 ? 'neg' : ''}>{rpRingkas(h.labaBersih)}</b>
      </span>
      <span>
        BEP <b>{teksBep(h)}</b>
      </span>
      <span>
        OER <b>{persen(h.oer)}</b>
      </span>
    </div>,
    wadah
  );
}

export default function HasilKalkulator({ h, upgradeAktif }: { h: HasilHitung; upgradeAktif: boolean }) {
  const bepTeks = teksBep(h);
  const kartu: Kartu[] = [
    { label: 'Pendapatan /bln', nilai: rpRingkas(h.pendapatan), sub: `Okupansi ${persen(h.okupansi)}`, bg: G.ownPrimary },
    { label: 'Laba Bersih /bln', nilai: rpRingkas(h.labaBersih), sub: `${rpRingkas(h.labaBersih * 12)} /thn`, bg: G.ownPrimary },
    { label: 'OPEX /bln', nilai: rpRingkas(h.opex), sub: 'Tanpa penyusutan', bg: G.ownGray },
    { label: 'OER', nilai: persen(h.oer), sub: 'OPEX ÷ pendapatan', bg: G.ownGray },
    { label: 'BEP', nilai: bepTeks, sub: h.bepOkupansi === null ? undefined : `Okupansi ${persen(h.bepOkupansi)}`, bg: G.ownRose },
    { label: 'Margin of Safety', nilai: persen(h.marginOfSafety), sub: 'Jarak aman dari BEP', bg: G.ownRose },
    { label: 'ROI /thn', nilai: persen(h.roiTahunan), sub: h.roiTahunan === null ? 'Isi modal awal' : 'Laba setahun ÷ modal', bg: G.ownPrimary },
    { label: 'Payback Usaha', nilai: h.paybackUsaha === null ? '—' : bulan(h.paybackUsaha), sub: 'Modal ÷ laba bulanan', bg: G.ownGray },
    { label: 'CAC', nilai: rp(h.cac), sub: h.cacPayback === null ? undefined : `Balik dalam ${h.cacPayback.toLocaleString('id-ID', { maximumFractionDigits: 2 })} bln sewa`, bg: G.ownRose }
  ];

  const biaya = [
    { t: 'Biaya variabel', value: h.biayaVariabel, c: PAL.owner[0] },
    { t: 'Biaya tetap tunai', value: Math.max(0, h.biayaTetap - h.penyusutan), c: PAL.owner[2] },
    { t: 'Penyusutan', value: h.penyusutan, c: PAL.owner[1] },
    ...(h.pajak > 0 ? [{ t: 'Pajak', value: h.pajak, c: PAL.owner[3] }] : [])
  ].filter((s) => s.value > 0);
  const pendapatanTipe = h.perTipe
    .filter((t) => t.pendapatan > 0)
    .map((t, i) => ({ t: t.nama || `Tipe ${i + 1}`, value: t.pendapatan, c: PAL.owner[i % PAL.owner.length] }));

  return (
    <div className="kalk-hasil">
      <section className="stat-grid" style={{ ['--cols' as string]: 3 }}>
        {kartu.map((k) => (
          <KartuHasil key={k.label} {...k} />
        ))}
      </section>

      {h.peringatan.length > 0 && (
        <ul className="kalk-warn" role="status">
          {h.peringatan.map((p) => (
            <li key={p}>
              <AlertTriangle size={15} aria-hidden /> {p}
            </li>
          ))}
        </ul>
      )}

      <div className="grid mt">
        <ChartCard
          title="Laba Bersih vs Okupansi"
          legend={[
            { t: 'Laba bersih /bln', c: '#CF7B72' },
            { t: 'Titik impas (BEP)', c: '#C92D31' },
            { t: 'Posisi sekarang', c: '#F2D5CF' }
          ]}
        >
          <GrafikSensitivitas titik={h.sensitivitas} bepOkupansi={h.bepOkupansi} okupansi={h.okupansi} labaSekarang={h.labaBersih} />
        </ChartCard>
      </div>

      <div className="grid row-2 mt">
        <DonutBlock label="Komposisi Biaya /bln" segs={biaya} money centerLabel="Total biaya" />
        <DonutBlock label="Pendapatan per Tipe" segs={pendapatanTipe} money centerLabel="Pendapatan" />
      </div>

      {h.perTipe.length > 0 && (
        <div className="grid mt">
          <ChartCard title="Contribution Margin per Kamar (harga − biaya variabel)">
            <Bars
              cats={h.perTipe.map((t, i) => t.nama || `Tipe ${i + 1}`)}
              vals={h.perTipe.map((t) => Math.max(0, Math.round(t.cm)))}
              gradId="kalkCm"
              gradStops={<BarStopsOwner />}
            />
          </ChartCard>
        </div>
      )}

      <section className={`card mt kalk-upgrade${upgradeAktif ? ' is-on' : ''}`}>
        <div className="card__title">Skenario Upgrade {upgradeAktif ? '(aktif, ikut dihitung)' : '(nonaktif)'}</div>
        <dl className="kalk-dl">
          <div>
            <dt>Tambahan laba</dt>
            <dd>{rp(h.upgrade.deltaLaba)} /bln</dd>
          </div>
          <div>
            <dt>Payback</dt>
            <dd>{bulan(h.upgrade.payback)}</dd>
          </div>
          <div>
            <dt>ROI</dt>
            <dd>{persen(h.upgrade.roiTahunan)} /thn</dd>
          </div>
        </dl>
      </section>

      <section className="card mt">
        <div className="card__title">Rincian per Tipe Kamar (per bulan)</div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Tipe</th>
                <th>Terisi</th>
                <th>Pendapatan</th>
                <th>Listrik/kamar</th>
                <th>Variabel/kamar</th>
                <th>Tetap/kamar</th>
                <th>CM/kamar</th>
                <th>CM ratio</th>
                <th>Laba/kamar*</th>
              </tr>
            </thead>
            <tbody>
              {h.perTipe.length === 0 ? (
                <tr className="tbl-empty">
                  <td colSpan={9}>Belum ada tipe kamar.</td>
                </tr>
              ) : (
                h.perTipe.map((t, i) => (
                  <tr key={i}>
                    <td>{t.nama || `Tipe ${i + 1}`}</td>
                    <td>
                      {t.kamarTerisi}/{t.jumlahKamar}
                    </td>
                    <td>{rp(t.pendapatan)}</td>
                    <td>{rp(t.listrikPerKamar)}</td>
                    <td>{rp(t.variabelPerKamar)}</td>
                    <td>{rp(t.tetapPerKamar)}</td>
                    <td>{rp(t.cm)}</td>
                    <td>{persen(t.cmRatio)}</td>
                    <td className={t.labaPerKamar !== null && t.labaPerKamar < 0 ? 'neg' : ''}>{rp(t.labaPerKamar)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="kalk-muted">* Laba per kamar bila terisi, setelah biaya bersama dibagi rata ke semua kamar.</p>
        <p className="kalk-muted">
          Biaya tetap {rp(h.biayaTetap)} · biaya variabel {rp(h.biayaVariabel)} · BEP pendapatan {rp(h.bepPendapatan)} · WACM {rp(h.wacm)}
        </p>
      </section>
    </div>
  );
}
