'use client';

import { motion } from 'framer-motion';

/* Stagger antar-tier untuk intro Dashboard (item 4 UAT): elemen paling atas
   (stat card) muncul duluan, lalu tier berikutnya (chart), lalu tabel — tiap
   tier mulai 0.1s setelah tier sebelumnya. Dipakai membungkus BLOK, bukan
   elemen individual — animasi per-elemen di dalam blok (mis. path SVG chart)
   tetap jalan sendiri. */
export const TIER_DELAY = 0.1;

export default function Reveal({
  tier = 0,
  className,
  style,
  children
}: {
  tier?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: tier * TIER_DELAY, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
