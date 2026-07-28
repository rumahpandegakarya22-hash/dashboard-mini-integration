'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Modal berbasis portal.
 *
 * Di-render ke `document.body`, bukan di tempatnya dipanggil: pemanggilnya
 * duduk di dalam `.content` yang punya max-width dan stacking context sendiri,
 * jadi modal yang dirender di situ akan ikut terkurung kolom itu.
 *
 * `[data-app="ops"]` ikut dipasang di pembungkusnya karena seluruh token visual
 * theme-ops.css terikat ke atribut tersebut — di luar subtree app, modal akan
 * tampil tanpa gaya sama sekali.
 */
export default function Modal({
  open,
  title,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    // Kunci scroll halaman di belakang: tanpa ini, menggulir di dalam modal
    // ikut menggeser konten di baliknya begitu ujung daftar tercapai.
    const overflowLama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowLama;
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    // `data-app` dipasang di pembungkus TERPISAH, bukan di .modal-backdrop itu
    // sendiri: seluruh aturan theme-ops.css berbentuk `[data-app='ops'] .kelas`
    // yang menuntut hubungan turunan. Kalau kedua atribut menempel di satu
    // elemen, aturannya tidak cocok dan modal kehilangan position/z-index-nya —
    // ia berhenti melayang dan hanya menumpuk di akhir halaman.
    <div data-app="ops">
      {/* AnimatePresence membungkus SELURUH kondisi `open`, bukan early-return
          di atas — supaya animasi exit sempat diputar sebelum modal lepas
          dari DOM (early-return lama langsung unmount tanpa transisi). */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => {
              // Hanya klik pada latar yang menutup — klik di dalam panel ikut
              // ter-bubble ke sini kalau tidak dibedakan.
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <motion.div
              ref={panelRef}
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={title}
              tabIndex={-1}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <div className="modal-head">
                <h2 className="modal-title">{title}</h2>
                <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">{children}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
