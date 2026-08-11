'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, ClipboardCheck, LoaderCircle } from 'lucide-react';
import Modal from './Modal';
import { KONDISI_ITEMS } from '@/lib/kondisi-items';

interface Props {
  fase: 'awal' | 'akhir';
  userName: string;
}

type ApprovalRow = {
  id: number;
  id_penghuni: string;
  nama_penghuni: string;
  no_kamar: number | string;
  pic: string | null;
  tanggal_cek_awal?: string | null;
  tanggal_cek_akhir?: string | null;
  status_checkin?: string;
  status_checkout?: string;
  catatan_awal?: string | null;
  catatan_akhir?: string | null;
  foto_urls?: string | null;
} & Record<string, unknown>;

function extractItemValues(row: ApprovalRow, fase: 'awal' | 'akhir'): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { key } of KONDISI_ITEMS) {
    const col = `${key}_${fase}`;
    const val = row[col];
    result[key] = typeof val === 'string' && val ? val : '-';
  }
  return result;
}

const VALUE_COLOR: Record<string, string> = {
  'Baik': '#16a34a',
  'Perlu Perbaikan': '#d97706',
  'Rusak': '#dc2626',
  'N/A': '#6b7280',
  '-': '#6b7280',
};

export default function ApprovalKondisiPanel({ fase, userName }: Props) {
  const [rows, setRows] = useState<ApprovalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ApprovalRow | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/ops/admin/approval-kondisi?fase=${fase}`);
      const json = await res.json() as { data: ApprovalRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Gagal memuat data.');
      setRows(json.data.map((r) => ({ ...r, id: Number(r.id) })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    }
  }, [fase]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(row: ApprovalRow, action: 'setujui' | 'tolak') {
    const label = action === 'setujui' ? 'Setujui' : 'Tolak';
    const ok = window.confirm(`${label} kondisi kamar ${row.nama_penghuni}?`);
    if (!ok) return;
    setActionLoading(row.id);
    try {
      const res = await fetch('/api/ops/admin/approval-kondisi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, fase, action, by: userName }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Gagal memproses.');
      setRows((prev) => prev?.filter((r) => r.id !== row.id) ?? prev);
      if (preview?.id === row.id) setPreview(null);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Gagal memproses.');
    } finally {
      setActionLoading(null);
    }
  }

  const tanggal = (row: ApprovalRow) =>
    fase === 'awal' ? row.tanggal_cek_awal : row.tanggal_cek_akhir;
  const catatan = (row: ApprovalRow) =>
    fase === 'awal' ? row.catatan_awal : row.catatan_akhir;

  const modalTitle = preview
    ? `Preview Kondisi — ${preview.nama_penghuni} (Kamar ${preview.no_kamar})`
    : '';

  return (
    <div>
      {error && (
        <div className="banner error" role="alert" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {rows === null && !error && (
        <div className="bento-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bento-card">
              <div className="skeleton" style={{ height: 18, width: '60%' }} />
              <div className="skeleton" style={{ height: 14, width: '40%', marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {rows?.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Tidak ada pengajuan yang menunggu approval.</p>
        </div>
      )}

      <div className="bento-grid">
        {rows?.map((row) => {
          const isLoading = actionLoading === row.id;
          return (
            <div key={row.id} className="bento-card border-beam">
              <div className="bento-head">
                <span className="icon-tile" aria-hidden>
                  <ClipboardCheck size={18} />
                </span>
                <span className="bento-meta">
                  <span className="bento-title">{row.nama_penghuni}</span>
                  <span className="bento-sub">Kamar {row.no_kamar}</span>
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#d97706',
                  border: '1px solid #d97706',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}>
                  Menunggu
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                {row.pic && <div>PIC: {row.pic}</div>}
                {tanggal(row) && <div>Tgl Cek: {tanggal(row)}</div>}
              </div>

              <div className="btn-row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ flex: 1 }}
                  onClick={() => setPreview(row)}
                  disabled={isLoading}
                >
                  Preview
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  disabled={isLoading}
                  onClick={() => handleAction(row, 'setujui')}
                >
                  {isLoading ? <LoaderCircle size={14} className="spin" /> : 'Setujui'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ flex: 1, color: '#dc2626', borderColor: '#dc2626' }}
                  disabled={isLoading}
                  onClick={() => handleAction(row, 'tolak')}
                >
                  Tolak
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={preview !== null} title={modalTitle} onClose={() => setPreview(null)}>
        {preview && (() => {
          const items = extractItemValues(preview, fase);
          const fotoList = preview.foto_urls
            ? (preview.foto_urls as string).split('|').filter(Boolean)
            : [];
          return (
            <div className="form-col">
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                {preview.pic && <div>PIC: {preview.pic}</div>}
                {tanggal(preview) && <div>Tanggal Cek: {tanggal(preview)}</div>}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>No</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Item</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Kondisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KONDISI_ITEMS.map(({ no, key, label }) => {
                      const val = items[key];
                      const color = VALUE_COLOR[val] ?? '#6b7280';
                      return (
                        <tr key={key}>
                          <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)', color: 'var(--text-muted)' }}>
                            {no}
                          </td>
                          <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)' }}>
                            {label}
                          </td>
                          <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)' }}>
                            <span style={{ color, fontWeight: val !== '-' ? 500 : undefined }}>{val}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {catatan(preview) && (
                <div style={{ marginTop: 12, fontSize: '0.875rem' }}>
                  <strong>Catatan:</strong>
                  <p style={{ marginTop: 4, color: 'var(--text-muted)' }}>{catatan(preview)}</p>
                </div>
              )}

              {fotoList.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong style={{ fontSize: '0.875rem' }}>Foto Kamar:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {fotoList.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`Foto ${i + 1}`}
                          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="btn-row" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={actionLoading === preview.id}
                  onClick={() => handleAction(preview, 'setujui')}
                >
                  {actionLoading === preview.id ? <LoaderCircle size={14} className="spin" /> : 'Setujui'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ color: '#dc2626', borderColor: '#dc2626' }}
                  disabled={actionLoading === preview.id}
                  onClick={() => handleAction(preview, 'tolak')}
                >
                  Tolak
                </button>
                <button type="button" className="btn secondary" onClick={() => setPreview(null)}>
                  Tutup
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
