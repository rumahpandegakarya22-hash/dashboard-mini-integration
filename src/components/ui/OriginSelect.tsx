'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Dropdown bergaya OriginUI (21st.dev @originui) sebagai pengganti `<select>`
 * native, yang popup-nya tidak bisa dianimasikan.
 *
 * Versi ini memakai kelas CSS (styles/origin-ui.css), bukan Tailwind, karena
 * Tailwind di repo ini hanya aktif untuk (inventory). Padanan Tailwind-nya ada
 * di components/inventory/OriginSelect.tsx.
 *
 * Animasi masuk/keluar disalin dari sumber: fade-in-0 + zoom-in-95 +
 * slide-in-from-top-2, durasi 150ms ease-[0.4,0,0.2,1].
 */

export interface OriginOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export default function OriginSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Pilih…',
  disabled,
  required,
  ariaLabel,
  className = '',
  style
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  options: OriginOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
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
    <div className="ou-select" ref={wrap}>
      {/* Nilai tetap ikut FormData kalau dipakai di dalam <form>. */}
      {name && <input type="hidden" name={name} value={value} required={required} />}

      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`ou-select__trigger ${className}`}
        style={style}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={terpilih ? 'ou-select__value' : 'ou-select__value is-placeholder'}>
          {terpilih ? terpilih.label : placeholder}
        </span>
        <ChevronDown className="ou-select__chevron" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={ariaLabel}
            className="ou-menu"
            style={{ transformOrigin: 'top' }}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          >
            {options.length === 0 && <li className="ou-item">Tidak ada pilihan</li>}
            {options.map((o) => {
              const aktif = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={aktif}
                    disabled={o.disabled}
                    className={aktif ? 'ou-item is-active' : 'ou-item'}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <span className="ou-item__check">{aktif && <Check aria-hidden />}</span>
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
