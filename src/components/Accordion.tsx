'use client';

import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

/**
 * Accordion satu bagian.
 *
 * Dibangun dari <button> + aria-expanded, bukan <details>/<summary>: isinya
 * mengandung form dengan tombol dan input, dan perilaku default <summary>
 * (klik di mana pun menutup bagian) menabrak itu.
 *
 * Isi TIDAK dilepas dari DOM saat tertutup — dibungkus `hidden` — supaya nilai
 * yang sudah diketik di form tidak hilang begitu bagiannya dilipat.
 */
export default function Accordion({
  title,
  subtitle,
  defaultOpen = false,
  children
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <section className="accordion" data-open={open}>
      <button
        type="button"
        className="accordion-head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="accordion-title">
          {title}
          {subtitle && <span className="accordion-sub">{subtitle}</span>}
        </span>
        {/* Rotasi chevron sudah ditangani CSS lewat [data-open] di .accordion —
            tidak dobel dianimasi di sini supaya tidak numpuk jadi 360°. */}
        <ChevronDown size={20} className="accordion-chevron" aria-hidden />
      </button>
      {/* Wrapper luar HANYA mengurus tinggi (0 <-> auto) + overflow; padding
          tetap di .accordion-body bagian dalam supaya tidak ikut "mengempis"
          jadi sliver setinggi padding saat tertutup. Isi TIDAK dilepas dari
          DOM saat tertutup — form di dalamnya jangan kehilangan nilai. */}
      <motion.div
        inert={!open || undefined}
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
        style={{ overflow: 'hidden' }}
      >
        <div id={id} className="accordion-body">
          {children}
        </div>
      </motion.div>
    </section>
  );
}
