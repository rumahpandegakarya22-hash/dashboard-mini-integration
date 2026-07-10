'use client';

import { MotionConfig } from 'framer-motion';

/** prefers-reduced-motion memangkas semua animasi framer-motion ke transisi instan. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
