'use client';

import { useEffect, useRef, useState } from 'react';

/* PORT dari `setupChartTooltip()` public/app.js (Fase 4).

   Perilaku dipertahankan: delegasi event di level dokumen membaca atribut
   data-tip-* dari elemen SVG mana pun (segmen donut, titik line chart), lalu
   menampilkan callout yang mengikuti kursor dan membalik posisi saat mepet tepi
   viewport (padding 14px — nilai dari sumber).

   Perbedaan implementasi: versi lama menyuntik <div> ke document.body dan
   mengisinya via innerHTML. Di sini tooltip dirender React dan isinya masuk
   sebagai teks, bukan HTML — menutup jalur injeksi kalau suatu saat ada label
   yang berasal dari data pengguna. Tampilan & kelas CSS (.chart-tip,
   .chart-tip__dot, .chart-tip__lab) tidak berubah.

   Pasang SEKALI saja di shell dashboard. */

interface TipState {
  label: string;
  value: string;
  color: string;
}

export default function ChartTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Element | null>(null);

  useEffect(() => {
    const PAD = 14;

    const onOver = (e: Event) => {
      const target = e.target as Element;
      const t = target?.closest?.('[data-tip-label]');
      if (!t) return;
      activeRef.current = t;
      setTip({
        label: t.getAttribute('data-tip-label') || '',
        value: t.getAttribute('data-tip-value') || '',
        color: t.getAttribute('data-tip-color') || 'currentColor'
      });
    };

    const onMove = (e: MouseEvent) => {
      const box = ref.current;
      if (!box) return;
      const tw = box.offsetWidth;
      const th = box.offsetHeight;
      let x = e.clientX + PAD;
      let y = e.clientY + PAD;
      if (x + tw > window.innerWidth) x = e.clientX - tw - PAD;
      if (y + th > window.innerHeight) y = e.clientY - th - PAD;
      setPos({ x, y });
    };

    const onOut = (e: Event) => {
      const target = e.target as Element;
      const t = target?.closest?.('[data-tip-label]');
      if (t && t === activeRef.current) {
        activeRef.current = null;
        setTip(null);
      }
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseout', onOut);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onOut);
    };
  }, []);

  return (
    <div ref={ref} className="chart-tip" hidden={!tip} style={{ left: pos.x, top: pos.y }}>
      {tip && (
        <>
          <span className="chart-tip__dot" style={{ background: tip.color }} />
          <span className="chart-tip__lab">{tip.label}</span>
          <b>{tip.value}</b>
        </>
      )}
    </div>
  );
}
