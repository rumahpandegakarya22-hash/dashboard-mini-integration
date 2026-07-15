'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, CircleAlert, ClipboardList, ImageIcon } from 'lucide-react';
import type { WorkOrderRow } from '@/lib/joblist';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Complete'];

/**
 * Tabel joblist work order di home (Mini App Improvement §2 & §4):
 * notif jumlah WO pending + tabel pekerjaan divisi ini, dgn kolom ubah status.
 */
export default function Joblist({ rows, divisi }: { rows: WorkOrderRow[]; divisi: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  const pendingCount = rows.filter((r) => r.status === 'Pending').length;

  async function changeStatus(id: number, status: string) {
    setBusy(id);
    setError('');
    try {
      const res = await fetch('/api/joblist/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengubah status.');
      router.refresh();
    } catch (e: any) {
      setError(e.message || 'Gagal mengubah status.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Joblist Work Order">
      <h2 className="section-title">Joblist Work Order{divisi ? ` — Divisi ${divisi}` : ' — Semua Divisi'}</h2>

      {pendingCount > 0 && (
        <div className="banner warn" role="status" style={{ marginBottom: 12, marginTop: 0 }}>
          <BellRing size={16} />
          <span>
            {pendingCount} work order berstatus <strong>Pending</strong> menunggu {divisi ? 'divisimu' : 'ditindak'}.
          </span>
        </div>
      )}

      {error && (
        <div className="banner error" role="alert" style={{ marginBottom: 12, marginTop: 0 }}>
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}>
            <ClipboardList size={16} /> Tidak ada work order untuk {divisi ? `divisi ${divisi}` : 'saat ini'}.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="joblist-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Lokasi/Item</th>
                  <th>Kategori</th>
                  <th>Deskripsi</th>
                  <th>Prioritas</th>
                  <th>Dari</th>
                  {!divisi && <th>Tujuan</th>}
                  <th>Deadline</th>
                  <th>Foto</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.tanggalInput}</td>
                    <td>{r.lokasiItem}</td>
                    <td>{r.kategori}</td>
                    <td style={{ maxWidth: 220, whiteSpace: 'normal' }}>{r.deskripsi}</td>
                    <td>
                      <span className={`prio-badge ${r.prioritas === 'Darurat' || r.prioritas === 'Tinggi' ? 'hot' : ''}`}>
                        {r.prioritas}
                      </span>
                    </td>
                    <td>{r.divisiAsal}</td>
                    {!divisi && <td>{r.tujuanDivisi}</td>}
                    <td>{r.targetDeadline || '-'}</td>
                    <td>
                      {r.buktiFotoUrl ? (
                        <a href={r.buktiFotoUrl} target="_blank" rel="noopener noreferrer" title="Lihat bukti foto">
                          <ImageIcon size={16} />
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <select
                        aria-label={`Status WO #${r.id}`}
                        value={r.status}
                        disabled={busy === r.id}
                        onChange={(e) => changeStatus(r.id, e.target.value)}
                        style={{ minHeight: 36, padding: '6px 32px 6px 10px', fontSize: '0.875rem', width: 'auto' }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
