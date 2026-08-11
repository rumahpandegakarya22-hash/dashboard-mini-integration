'use client';

import { motion } from 'framer-motion';
import PengaduanPanel from './PengaduanPanel';
import ReviewPendaftaranPanel from './ReviewPendaftaranPanel';
import VerifikasiBuktiPanel from './VerifikasiBuktiPanel';
import PengajuanPanel from './PengajuanPanel';

const PANEL: Record<string, () => React.ReactNode> = {
  feedback: () => <PengaduanPanel />,
  'pembayaran-sewa': () => <VerifikasiBuktiPanel />,
  'penghuni-baru': () => <ReviewPendaftaranPanel />,
  'pindah-kamar': () => <PengajuanPanel jenis="pindah" />,
  checkout: () => <PengajuanPanel jenis="checkout" />
};

export default function ModulePanel({ moduleId }: { moduleId: string }) {
  const render = PANEL[moduleId];
  if (!render) return null;
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      {render()}
    </motion.div>
  );
}
