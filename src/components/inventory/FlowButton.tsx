'use client';

import { ArrowRight } from 'lucide-react';

/**
 * Port FlowButton (21st.dev @xubohuah). Mekanika animasinya disalin persis —
 * durasi 600/800ms, easing cubic-bezier yang sama, panah masuk dari kiri &
 * keluar ke kanan, lingkaran yang memuai jadi 220px, radius yang berubah dan
 * `active:scale-[0.95]`.
 *
 * Warnanya dipetakan ke palet Inventory: sumber memakai #111111 di atas tombol
 * transparan, di sini tombolnya sudah bg-accent sehingga lingkarannya memakai
 * accent-dark — efeknya jadi riak yang mengisi tombol.
 *
 * `arrows`: tombol yang sudah punya ikon sendiri memakai "right" supaya panah
 * kiri tidak menimpa ikon itu.
 */

export type FlowArrows = 'both' | 'right' | 'none';

const ARROW =
  'absolute w-4 h-4 fill-none z-[9] transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]';

export default function FlowButton({
  children,
  className = '',
  arrows = 'right',
  /* Warna riak yang memuai. Default accent-dark cocok untuk tombol bg-accent;
     tombol berwarna lain (mis. emerald) mengoper warnanya sendiri. */
  rippleClassName = 'bg-accent-dark',
  ...rest
}: { arrows?: FlowArrows; rippleClassName?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`group relative overflow-hidden cursor-pointer transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:rounded-[12px] active:scale-[0.95] ${className}`}
    >
      {arrows === 'both' && (
        <ArrowRight aria-hidden className={`${ARROW} left-[-25%] group-hover:left-4`} />
      )}
      <span className="relative z-[1] flex items-center justify-center gap-2 -translate-x-3 group-hover:translate-x-3 transition-all duration-[800ms] ease-out">
        {children}
      </span>
      <span
        aria-hidden
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-[50%] opacity-0 group-hover:w-[220px] group-hover:h-[220px] group-hover:opacity-100 transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${rippleClassName}`}
      />
      {arrows !== 'none' && (
        <ArrowRight aria-hidden className={`${ARROW} right-4 group-hover:right-[-25%]`} />
      )}
    </button>
  );
}
