'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

/**
 * Transisi halaman bersama seluruh sub-app (Dashboard/Ops/Inventory).
 * Pola "scale-without-limits": scale+fade masuk saat route berganti.
 * Dipasang lewat `template.tsx` per route group — Next me-remount
 * template setiap navigasi, jadi animasi masuk berjalan tiap pindah halaman.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
