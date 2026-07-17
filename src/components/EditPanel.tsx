'use client';

import { useState } from 'react';
import { ChevronLeft, CircleAlert, LoaderCircle, PencilLine } from 'lucide-react';
import DynamicForm from './DynamicForm';
import type { FieldDef } from '@/lib/modules/types';

interface Entry {
  ref: string;
  label: string;
  values: Record<string, string>;
}

/**
 * Panel "Edit Data" di bawah form input modul (fitur edit database per menu):
 * muat entri terakhir → pilih → form yang sama terisi nilai lama → simpan menimpa
 * entri tsb (POST /api/edit/[moduleId], bukan menambah baris baru).
 */
export default function EditPanel({ moduleId, fields }: { moduleId: string; fields: FieldDef[] }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Entry | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/edit/${moduleId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat data.');
      setEntries(json.entries);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }

  if (selected) {
    return (
      <section aria-label="Edit Data" style={{ marginTop: 28 }}>
        <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PencilLine size={16} /> Edit: {selected.label}
        </h2>
        <button
          type="button"
          className="btn-plain"
          style={{ marginBottom: 8 }}
          onClick={() => setSelected(null)}
        >
          <ChevronLeft size={16} />
          Batal — kembali ke daftar
        </button>
        <DynamicForm
          key={selected.ref}
          moduleId={moduleId}
          fields={fields}
          editRef={selected.ref}
          initialValues={selected.values}
          onEditDone={() => {
            setSelected(null);
            setEntries(null); // muat ulang daftar biar label/isi terbaru kebaca
          }}
        />
      </section>
    );
  }

  return (
    <section aria-label="Edit Data" style={{ marginTop: 28 }}>
      <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <PencilLine size={16} /> Edit Data
      </h2>
      <div className="card">
        {error && (
          <div className="banner error" role="alert">
            <CircleAlert size={16} />
            <span>{error}</span>
          </div>
        )}
        {entries === null ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Salah input? Muat entri terakhir modul ini lalu perbaiki — data lama ditimpa, bukan menambah baris baru.
            </p>
            <button type="button" className="btn secondary" disabled={loading} onClick={load}>
              {loading && <LoaderCircle size={18} className="spin" />}
              {loading ? 'Memuat...' : 'Muat Data Terakhir'}
            </button>
          </>
        ) : entries.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Belum ada data untuk diedit.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {entries.map((e) => (
              <li key={e.ref} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                {/* .btn global width:100% — di daftar ini tombol harus auto supaya label kebaca */}
                <span style={{ fontSize: '0.875rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.label}
                </span>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ width: 'auto', minHeight: 36, padding: '6px 14px', fontSize: '0.875rem', flex: 'none' }}
                  onClick={() => setSelected(e)}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
