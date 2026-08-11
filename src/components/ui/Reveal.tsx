'use client';

import { motion } from 'framer-motion';

export const TIER_DELAY = 0.15;

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
