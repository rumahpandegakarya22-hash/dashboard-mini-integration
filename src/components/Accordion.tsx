'use client';

import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

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
