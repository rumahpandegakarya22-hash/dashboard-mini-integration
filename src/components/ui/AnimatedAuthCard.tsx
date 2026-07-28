'use client';

import { motion } from 'framer-motion';

/**
 * Kartu sign-in animasi masuk — dipakai bersama seluruh layar auth
 * ((auth)/login, sign-up, 2fa, pending), yang sudah disatukan lewat
 * satu identitas visual Ops (lihat (auth)/layout.tsx).
 */
export default function AnimatedAuthCard({
  children,
  className = 'center-card'
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
