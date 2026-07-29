'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { PERIODS } from '@/config/dashboard-nav';
import { GlassDateField } from '@/components/ui/GlassCalendar';
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
            style={{ transformOrigin: 'top' }}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          >
            {PERIODS.map((p, i) => (
              <motion.button
                key={p}
                type="button"
                className={`period-opt ${p === period ? 'is-active' : ''}`}
                data-period={p}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12, delay: i * 0.02 }}
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
          <GlassDateField id="pFrom" value={from || ''} onChange={(v) => push({ from: v })} placeholder="Dari" />
          <span>–</span>
          <GlassDateField id="pTo" value={to || ''} onChange={(v) => push({ to: v })} placeholder="Sampai" />
        </div>
      )}
    </div>
  );
}
