'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Port GlassCalendar (21st.dev @ravikatiyar162).
 *
 * Dua catatan penting:
 *  1. Komponen aslinya STRIP MINGGUAN horizontal, bukan date picker. Karena di
 *     sini dipakai menggantikan `<input type="date">`, grid bulanan ditambahkan.
 *  2. Tailwind di repo ini hanya aktif untuk route group (inventory) — lihat
 *     tailwind.config.ts. Jadi gayanya ditulis sebagai CSS biasa di
 *     styles/glass-calendar.css (kelas `.glass-cal*`), bukan utilitas Tailwind.
 *     Nilai visualnya tetap disalin dari sumber.
 */

const DOW = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const pad = (n: number) => String(n).padStart(2, '0');
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* `new Date('2026-07-29')` diparse sebagai UTC dan bisa mundur sehari di WIB —
   makanya tanggalnya dirakit manual. */
function fromIso(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const CalIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

export function GlassCalendar({
  selectedDate,
  onDateSelect
}: {
  selectedDate?: Date;
  onDateSelect?: (d: Date) => void;
}) {
  const [bulan, setBulan] = useState(selectedDate ?? new Date());
  const hariIni = new Date();

  const geser = (delta: number) => setBulan(new Date(bulan.getFullYear(), bulan.getMonth() + delta, 1));

  const kosongDepan = new Date(bulan.getFullYear(), bulan.getMonth(), 1).getDay();
  const jumlahHari = new Date(bulan.getFullYear(), bulan.getMonth() + 1, 0).getDate();
  const judul = `${BULAN[bulan.getMonth()]} ${bulan.getFullYear()}`;

  return (
    <div className="glass-cal">
      <div className="glass-cal__head">
        <motion.p
          key={judul}
          className="glass-cal__month"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {judul}
        </motion.p>
        <div className="glass-cal__nav">
          <button type="button" aria-label="Bulan sebelumnya" onClick={() => geser(-1)}>
            <ChevronLeft />
          </button>
          <button type="button" aria-label="Bulan berikutnya" onClick={() => geser(1)}>
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="glass-cal__grid">
        {DOW.map((d, i) => (
          <span key={i} className="glass-cal__dow">{d}</span>
        ))}
        {Array.from({ length: kosongDepan }, (_, i) => <span key={`k${i}`} />)}
        {Array.from({ length: jumlahHari }, (_, i) => {
          const d = new Date(bulan.getFullYear(), bulan.getMonth(), i + 1);
          const dipilih = selectedDate ? sameDay(d, selectedDate) : false;
          const ini = sameDay(d, hariIni);
          return (
            <button
              key={i}
              type="button"
              aria-pressed={dipilih}
              className={`glass-cal__day${dipilih ? ' is-selected' : ''}`}
              onClick={() => onDateSelect?.(d)}
            >
              {ini && !dipilih && <span className="glass-cal__dot" />}
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="glass-cal__rule" />

      <div className="glass-cal__foot">
        <button
          type="button"
          className="glass-cal__today"
          onClick={() => {
            setBulan(new Date());
            onDateSelect?.(new Date());
          }}
        >
          <CalIcon />
          <span>Hari ini</span>
        </button>
        <span className="glass-cal__value">{selectedDate ? toIso(selectedDate) : 'Belum dipilih'}</span>
      </div>
    </div>
  );
}

/** Pengganti drop-in untuk `<input type="date">`. */
export function GlassDateField({
  id,
  name,
  required,
  value,
  onChange,
  placeholder = 'Pilih tanggal',
  className = '',
  /* Default-nya memakai token Dashboard. Ops & Inventory mengoper kelasnya
     sendiri karena token itu tidak ada di sana. */
  buttonClassName = 'glass-cal-field__btn'
}: {
  id?: string;
  name?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className={`glass-cal-field ${className}`} ref={wrap}>
      {/* Nilai tetap ikut FormData kalau dipakai di dalam <form>. */}
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <button
        type="button"
        id={id}
        className={buttonClassName}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{value || placeholder}</span>
        <CalIcon />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="glass-cal-field__pop"
            role="dialog"
            aria-label="Pilih tanggal"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <GlassCalendar
              selectedDate={fromIso(value) ?? undefined}
              onDateSelect={(d) => {
                onChange(toIso(d));
                setOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
