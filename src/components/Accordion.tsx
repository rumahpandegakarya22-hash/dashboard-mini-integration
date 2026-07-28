'use client';

import { useId, useState } from 'react';
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
        <ChevronDown size={20} className="accordion-chevron" aria-hidden />
      </button>
      <div id={id} className="accordion-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
