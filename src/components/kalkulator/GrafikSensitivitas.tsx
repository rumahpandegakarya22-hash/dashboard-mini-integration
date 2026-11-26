'use client';

import { useBox } from '@/components/charts/useBox';
import { persen, rpRingkas } from '@/lib/kalkulator/format';

const WARNA_LABA = '#CF7B72';
const WARNA_BEP = '#C92D31';

/** Laba bersih/bulan terhadap okupansi 0–100%, dengan garis nol, penanda BEP, dan posisi okupansi saat ini. */
export default function GrafikSensitivitas({
  titik,
  bepOkupansi,
  okupansi,
  labaSekarang
}: {
  titik: { okupansi: number; laba: number }[];
  bepOkupansi: number | null;
  okupansi: number | null;
  labaSekarang: number;
}) {
  const { ref, w, h } = useBox(560, 260);
  const padL = 64;
  const padR = 14;
  const padT = 14;
  const padB = 28;
  const cw = Math.max(1, w - padL - padR);
  const ch = Math.max(1, h - padT - padB);

  const nilai = [...titik.map((t) => t.laba), labaSekarang, 0];
  let min = Math.min(...nilai);
  let max = Math.max(...nilai);
  if (max === min) max = min + 1;
  const ruang = (max - min) * 0.08;
  min -= ruang;
  max += ruang;

  const x = (ok: number) => padL + (ok / 100) * cw;
  const y = (v: number) => padT + ((max - v) / (max - min)) * ch;
  const garis = titik.map((t) => `${x(t.okupansi).toFixed(1)},${y(t.laba).toFixed(1)}`).join(' ');
  const area = `${x(0)},${y(0)} ${garis} ${x(100)},${y(0)}`;
  const tickY = [max - ruang, (max + min) / 2, min + ruang];

  const deskripsi =
    `Laba bersih per bulan dari okupansi 0% sampai 100%. ` +
    (bepOkupansi !== null ? `Titik impas di okupansi ${persen(bepOkupansi)}. ` : 'Titik impas tidak tercapai. ') +
    `Saat ini ${persen(okupansi)} dengan laba ${rpRingkas(labaSekarang)}.`;

  return (
    <div className="chart" ref={ref} style={{ minHeight: 260 }}>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={deskripsi}>
        <defs>
          <linearGradient id="kalkSensArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={WARNA_LABA} stopOpacity="0.45" />
            <stop offset="100%" stopColor={WARNA_LABA} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {tickY.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke="var(--rail)" opacity=".5" />
            <text className="chart-axis" x={padL - 6} y={y(v) + 3} textAnchor="end">
              {rpRingkas(v)}
            </text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((ok) => (
          <text key={ok} className="chart-axis" x={x(ok)} y={h - 8} textAnchor="middle">
            {ok}%
          </text>
        ))}

        <polygon points={area} fill="url(#kalkSensArea)" />
        <line x1={padL} x2={w - padR} y1={y(0)} y2={y(0)} stroke="var(--text-3)" strokeWidth="1" />
        <polyline points={garis} fill="none" stroke={WARNA_LABA} strokeWidth="2.5" strokeLinejoin="round" />

        {bepOkupansi !== null && bepOkupansi <= 1 && (
          <g>
            <line x1={x(bepOkupansi * 100)} x2={x(bepOkupansi * 100)} y1={padT} y2={padT + ch} stroke={WARNA_BEP} strokeDasharray="5 4" strokeWidth="1.5" />
            <text className="chart-val" x={x(bepOkupansi * 100) + 5} y={padT + 10} fill={WARNA_BEP}>
              BEP {persen(bepOkupansi)}
            </text>
          </g>
        )}
        {okupansi !== null && (
          <circle cx={x(okupansi * 100)} cy={y(labaSekarang)} r="5.5" fill="var(--owner-blush)" stroke={WARNA_LABA} strokeWidth="2.5" />
        )}
      </svg>
    </div>
  );
}
