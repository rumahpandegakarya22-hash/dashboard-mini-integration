'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Ukuran kotak chart yang sebenarnya (px). Chart digambar 1:1 dengan piksel layar,
 * jadi melebar mengikuti lebar kartu dan memanjang mengikuti tinggi kartu
 * (kartu satu baris grid melar mengikuti saudaranya) tanpa teks ikut membesar.
 * Sebelum terukur (SSR), dipakai ukuran bawaan.
 */
export function useBox(defW: number, defH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: defW, h: defH });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ukur = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (w > 0 && h > 0) setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ...box };
}
