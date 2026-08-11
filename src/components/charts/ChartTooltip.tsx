'use client';

import { useEffect, useRef, useState } from 'react';


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
    // Jarak tooltip ke pointer. 14px terasa jauh saat dipakai (UAT #5);
    // 6px masih cukup agar kursor tidak menutupi teksnya.
    const PAD = 8;

    const onOver = (e: Event) => {
      const target = e.target as Element;
      const t = target?.closest?.('[data-tip-label]');
      if (!t) return;
      const me = e as MouseEvent;
      activeRef.current = t;
      setTip({
        label: t.getAttribute('data-tip-label') || '',
        value: t.getAttribute('data-tip-value') || '',
        color: t.getAttribute('data-tip-color') || 'currentColor'
      });
      setPos({ x: me.clientX + PAD, y: me.clientY + PAD });
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
