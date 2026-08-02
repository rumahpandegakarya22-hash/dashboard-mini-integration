'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
 *
 * Menu di-portal ke <body> (position: fixed, posisi dihitung manual dari
 * getBoundingClientRect trigger) — BUKAN lagi position:absolute mengikuti alur
 * dokumen. Dulu popup ini nempel di dalam .ou-select (position:relative) biasa,
 * jadi kalau field-nya duduk di dalam container yang overflow:auto (mis. .modal
 * di Modal.tsx, max-height:86vh), popupnya kepotong batas scroll leluhur itu —
 * tidak terlihat penuh. `data-app` di-deteksi dari leluhur trigger krn seluruh
 * token warna origin-ui.css terikat ke atribut itu (sama seperti alasan Modal.tsx
 * memasang data-app di pembungkus portalnya sendiri).
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
  const [pos, setPos] = useState<{ top: number; left: number; width: number; appAttr: string | null } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  // Hitung ulang posisi tiap kali dibuka + saat scroll/resize apa pun di halaman
  // (capture:true krn scroll bisa terjadi di container manapun, bukan cuma window).
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
        appAttr: triggerRef.current?.closest('[data-app]')?.getAttribute('data-app') ?? null
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrap.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
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
        ref={triggerRef}
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

      {typeof document !== 'undefined' &&
        createPortal(
          <div data-app={pos?.appAttr ?? undefined}>
            <AnimatePresence>
              {open && pos && (
                <motion.ul
                  ref={menuRef}
                  role="listbox"
                  aria-label={ariaLabel}
                  className="ou-menu"
                  style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, transformOrigin: 'top' }}
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
          </div>,
          document.body
        )}
    </div>
  );
}
