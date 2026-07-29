'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Dropdown bergaya OriginUI (21st.dev @originui) sebagai pengganti `<select>`
 * native, yang popup-nya tidak bisa dianimasikan.
 *
 * Yang disalin dari sumber:
 *   - Panel: rounded-lg, min-w-40, p-1, border 1px, shadow-lg shadow-black/5
 *   - Item: rounded-md, px-2 py-1.5, text-sm, gap-2, transition-colors
 *   - Indikator terpilih: span absolut left-2, kotak 3.5, ikon Check h-4 w-4
 *   - Masuk/keluar: fade-in-0 + zoom-in-95 + slide-in-from-top-2
 *
 * Yang sengaja BEDA: OriginUI memakai token shadcn (bg-popover, focus:bg-accent).
 * Di app ini `accent` adalah merah #C92D31 — kalau dipakai sebagai latar item
 * hover, kontras teksnya jadi rusak. Jadi warnanya dipetakan ke palet Inventory
 * (putih / sand / ink) dengan peran yang sama.
 */

export interface OriginOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export default function OriginSelect({
  value,
  onChange,
  options,
  placeholder = 'Pilih…',
  disabled,
  required,
  name,
  id,
  className = '',
  ariaLabel
}: {
  value: string;
  onChange: (v: string) => void;
  options: OriginOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const terpilih = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={wrap}>
      {/* Nilai tetap ikut FormData kalau dipakai di dalam <form>. */}
      {name && <input type="hidden" name={name} value={value} required={required} />}

      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className={terpilih ? 'truncate' : 'truncate text-taupe'}>
          {terpilih ? terpilih.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-taupe transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={ariaLabel}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformOrigin: 'top' }}
            className="absolute left-0 top-full z-50 mt-1 max-h-72 min-w-40 w-full overflow-auto rounded-lg border border-sand bg-white p-1 shadow-lg shadow-ink/5"
          >
            {options.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-taupe">Tidak ada pilihan</li>
            )}
            {options.map((o) => {
              const aktif = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={aktif}
                    disabled={o.disabled}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`relative flex w-full cursor-default select-none items-center gap-2 rounded-md py-1.5 pl-8 pr-2 text-left text-sm outline-none transition-colors hover:bg-sand/60 focus-visible:bg-sand/60 disabled:pointer-events-none disabled:opacity-50 ${
                      aktif ? 'bg-sand/40 text-ink' : 'text-ink'
                    }`}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      {aktif && <Check className="h-4 w-4" />}
                    </span>
                    {o.label}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
