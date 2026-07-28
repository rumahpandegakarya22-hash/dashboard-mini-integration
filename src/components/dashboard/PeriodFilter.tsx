'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { PERIODS } from '@/config/dashboard-nav';
import { IconCal, IconCaret } from './icons';

/* PORT dari `periodFilter()` public/app.js (Fase 4).

   Perbedaan yang disengaja (§2.3): periode tidak lagi disimpan di state global
   `cur`, melainkan di **searchParams** — sehingga tampilan ter-filter bisa
   di-bookmark dan di-share, dan Server Component bisa membacanya langsung.
   Markup & kelas (.side-period, .period-toggle, .period-menu, .period-opt,
   .period-custom) dipertahankan agar CSS hasil port berlaku. */

export default function PeriodFilter({
  period,
  from,
  to
}: {
  period: string;
  from?: string;
  to?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const push = (next: Record<string, string | undefined>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    router.push(`${pathname}?${q.toString()}`);
  };

  return (
    <div className="side-section side-period">
      <div className="side-section__title">Filter Periode</div>

      <button type="button" className="period-toggle" id="periodToggle" onClick={() => setOpen((o) => !o)}>
        <IconCal />
        <span>{period}</span>
        <IconCaret />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="period-menu"
            id="periodMenu"
            style={{ overflow: 'hidden', transformOrigin: 'top' }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {PERIODS.map((p, i) => (
              <motion.button
                key={p}
                type="button"
                className={`period-opt ${p === period ? 'is-active' : ''}`}
                data-period={p}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.16, delay: i * 0.025 }}
                onClick={() => {
                  setOpen(false);
                  push({ period: p, ...(p === 'Custom' ? {} : { from: undefined, to: undefined }) });
                }}
              >
                {p}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {period === 'Custom' && (
        <div className="period-custom">
          <input type="date" id="pFrom" value={from || ''} onChange={(e) => push({ from: e.target.value })} />
          <span>–</span>
          <input type="date" id="pTo" value={to || ''} onChange={(e) => push({ to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
