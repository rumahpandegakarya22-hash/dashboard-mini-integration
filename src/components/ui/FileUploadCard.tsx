'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Trash2, UploadCloud } from 'lucide-react';


export function formatFileSize(b: number) {
  if (b === 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

const varianKartu = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const varianItem = { hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } };

export default function FileUploadCard({
  id,
  name,
  accept,
  disabled,
  judul = 'Unggah berkas',
  deskripsi = 'Pilih dan unggah berkas yang diminta',
  petunjuk,
  berkas,
  uploading,
  done,
  onPick,
  onRemove
}: {
  id?: string;
  name?: string;
  accept?: string;
  disabled?: boolean;
  judul?: string;
  deskripsi?: string;
  petunjuk?: string;
  berkas: { nama: string; ukuran?: number } | null;
  uploading?: boolean;
  done?: boolean;
  onPick: (f: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const stop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <motion.div
      className="upload-card"
      variants={varianKartu}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.3 }}
    >
      <div className="upload-card__head">
        <span className="upload-card__icon">
          <UploadCloud size={24} aria-hidden />
        </span>
        <div>
          <p className="upload-card__title">{judul}</p>
          <p className="upload-card__sub">{deskripsi}</p>
        </div>
      </div>

      <div
        className={dragging ? 'upload-card__drop is-dragging' : 'upload-card__drop'}
        onDragEnter={(e) => {
          stop(e);
          setDragging(true);
        }}
        onDragLeave={(e) => {
          stop(e);
          setDragging(false);
        }}
        onDragOver={stop}
        onDrop={(e) => {
          stop(e);
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !disabled) onPick(f);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
        <UploadCloud size={40} aria-hidden />
        <p className="upload-card__lead">Pilih berkas atau seret ke sini.</p>
        {petunjuk && <p className="upload-card__hint">{petunjuk}</p>}
        <span className="upload-card__browse">Pilih Berkas</span>
      </div>

      <AnimatePresence>
        {berkas && (
          <motion.ul
            className="upload-card__list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <motion.li
              className="upload-card__row"
              variants={varianItem}
              initial="hidden"
              animate="visible"
              exit="hidden"
              layout
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span className="upload-card__ext">
                  {berkas.nama.split('.').pop()?.toUpperCase().substring(0, 3) || 'FILE'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p className="upload-card__name">{berkas.nama}</p>
                  <div className="upload-card__meta">
                    {typeof berkas.ukuran === 'number' && <span>{formatFileSize(berkas.ukuran)}</span>}
                    {typeof berkas.ukuran === 'number' && <span className="sep">•</span>}
                    <span className={uploading ? 'busy' : 'ok'}>
                      {uploading ? 'Mengunggah…' : done ? 'Selesai' : 'Siap'}
                    </span>
                  </div>
                  {uploading && (
                    <div className="upload-card__bar">
                      {/* Endpoint upload tidak melaporkan progres, jadi barnya
                          indeterminate: penuh selama proses berlangsung. */}
                      <i style={{ width: '100%' }} />
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {done && !uploading && <CheckCircle2 size={20} color="#15803d" aria-hidden />}
                <button
                  type="button"
                  className="upload-card__del"
                  aria-label={`Hapus ${berkas.nama}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inputRef.current) inputRef.current.value = '';
                    onRemove();
                  }}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </motion.li>
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
