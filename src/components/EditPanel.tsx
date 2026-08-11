'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, CircleAlert, LoaderCircle, PencilLine } from 'lucide-react';
import DynamicForm from './DynamicForm';
import Modal from './Modal';
import type { FieldDef } from '@/lib/modules/types';

interface Entry {
  ref: string;
  label: string;
  values: Record<string, string>;
}

export default function EditPanel({ moduleId, fields }: { moduleId: string; fields: FieldDef[] }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Entry | null>(null);

  async function buka() {
    setOpen(true);
    setSelected(null);
    if (entries !== null) return; // sudah dimuat sesi ini
    await muat();
  }

  async function muat() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/edit/${moduleId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat data.');
      setEntries(json.entries);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }

  const kolom = (e: Entry) => e.label.split('·').map((s) => s.trim());
  const jumlahKolom = Math.max(1, ...(entries ?? []).map((e) => kolom(e).length));

  return (
    <>
      <button type="button" className="btn secondary" onClick={buka}>
        <PencilLine size={16} />
        Edit Data
      </button>

      <Modal
        open={open}
        title={selected ? `Edit: ${selected.label}` : 'Edit Data'}
        onClose={() => setOpen(false)}
      >
        {error && (
          <div className="banner error" role="alert" style={{ marginBottom: 12 }}>
            <CircleAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Reflow daftar <-> detail dianimasi lewat AnimatePresence — dulu
            langsung loncat ganti konten tanpa transisi. */}
        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <button
                type="button"
                className="btn-plain"
                style={{ marginBottom: 12 }}
                onClick={() => setSelected(null)}
              >
                <ChevronLeft size={16} />
                Kembali ke daftar
              </button>
              <div className="form-col">
                <DynamicForm
                  key={selected.ref}
                  moduleId={moduleId}
                  fields={fields}
                  editRef={selected.ref}
                  initialValues={selected.values}
                  onEditDone={() => {
                    setSelected(null);
                    setEntries(null); // muat ulang daftar biar label/isi terbaru kebaca
                    void muat();
                  }}
                />
              </div>
            </motion.div>
          ) : loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-busy="true" aria-label="Memuat data">
              <div className="skeleton" style={{ height: 20, width: '45%' }} />
              <div className="skeleton" style={{ height: 44, marginTop: 14 }} />
              <div className="skeleton" style={{ height: 44, marginTop: 8 }} />
            </motion.div>
          ) : entries?.length === 0 ? (
            <motion.p key="empty" className="muted" style={{ margin: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Belum ada data untuk diedit.
            </motion.p>
          ) : (
            <motion.div key="list" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}>
              <p className="muted" style={{ marginTop: 0 }}>
                Salah input? Pilih entri di bawah lalu perbaiki — data lama ditimpa, bukan menambah baris baru.
              </p>
              <div className="table-scroll">
                <table className="joblist-table">
                  <thead>
                    <tr>
                      {Array.from({ length: jumlahKolom }, (_, i) => (
                        <th key={i} scope="col">
                          {i === 0 ? 'Entri' : ''}
                        </th>
                      ))}
                      <th scope="col">
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries?.map((e) => {
                      const sel = kolom(e);
                      return (
                        <tr key={e.ref} className="row-click" onClick={() => setSelected(e)}>
                          {Array.from({ length: jumlahKolom }, (_, i) => (
                            <td key={i}>{sel[i] ?? ''}</td>
                          ))}
                          <td>
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ width: 'auto', minHeight: 36, padding: '6px 14px', fontSize: '0.875rem' }}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setSelected(e);
                              }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn secondary" style={{ marginTop: 12 }} disabled={loading} onClick={muat}>
                {loading && <LoaderCircle size={18} className="spin" />}
                Muat Ulang
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </>
  );
}
