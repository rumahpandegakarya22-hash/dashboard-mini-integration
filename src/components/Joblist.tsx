'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, CircleAlert, ClipboardList, ImageIcon, ListChecks } from 'lucide-react';
import type { WorkOrderRow } from '@/lib/joblist';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Complete'];

/**
 * Tabel work order di home (Mini App Improvement §2 & §4 + fitur List Job):
 * - Staf: tabel Work Order = WO Pending divisinya (set "In Progress" → pindah ke
 *   List Job di bawah; PIC otomatis). Tabel List Job = WO In Progress dgn kolom
 *   Nomor/ID/Task/PIC/Status. "Complete" → hilang dari kedua tabel.
 * - Owner/pengawas: satu tabel logbook read-only (semua divisi & status), tanpa List Job.
 */
export default function Joblist({ rows, divisi }: { rows: WorkOrderRow[]; divisi: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  const readOnly = !divisi; // owner/pengawas: logbook saja
  const woRows = readOnly ? rows : rows.filter((r) => r.status === 'Pending');
  const jobRows = readOnly ? [] : rows.filter((r) => r.status === 'In Progress');
  const pendingCount = rows.filter((r) => r.status === 'Pending').length;

  async function changeStatus(id: number, status: string) {
    // Complete menghilangkan baris dari tabel staf — konfirmasi dulu biar tidak kepencet.
    if (status === 'Complete' && !window.confirm('Tandai selesai? Pekerjaan ini akan hilang dari tabel Work Order & List Job.')) {
      return;
    }
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

  function statusSelect(r: WorkOrderRow) {
    return (
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
    );
  }

  return (
    <>
      <section aria-label="Work Order">
        <h2 className="section-title">
          {readOnly ? 'Logbook Work Order — Semua Divisi' : `Work Order — Divisi ${divisi}`}
        </h2>

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
          {woRows.length === 0 ? (
            <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}>
              <ClipboardList size={16} />
              {readOnly ? 'Belum ada work order.' : `Tidak ada work order baru untuk divisi ${divisi}.`}
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
                    {readOnly && <th>Tujuan</th>}
                    {readOnly && <th>PIC</th>}
                    <th>Deadline</th>
                    <th>Foto</th>
                    {(readOnly || divisi === 'Admin') && <th>Biaya</th>}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {woRows.map((r) => (
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
                      {readOnly && <td>{r.tujuanDivisi}</td>}
                      {readOnly && <td>{r.pic || '-'}</td>}
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
                      {/* Biaya maintenance (WO tujuan Admin): Admin klik "Catat Pengeluaran" → form pengeluaran
                          ter-prefill; setelah submit, WO otomatis Complete (handler pengeluaran). */}
                      {(readOnly || divisi === 'Admin') && (
                        <td>
                          {r.nominal && r.nominal > 0 ? (
                            <>
                              Rp{r.nominal.toLocaleString('id-ID')}
                              {r.refTiket && <div className="muted" style={{ fontSize: '0.75rem' }}>{r.refTiket}</div>}
                              {divisi === 'Admin' && (
                                <a
                                  href={`/m/pengeluaran?woId=${r.id}&tanggal=${encodeURIComponent(r.tanggalInput)}&tipeAkun=Beban&nominal=${r.nominal}&kategori=Operasional&keterangan=${encodeURIComponent(`${r.deskripsi} — ${r.lokasiItem}${r.refTiket ? ` (${r.refTiket})` : ''}`)}`}
                                  style={{ display: 'inline-block', marginTop: 4, fontWeight: 600 }}
                                >
                                  Catat Pengeluaran →
                                </a>
                              )}
                            </>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                      {/* Owner/pengawas: read-only (logbook) + siapa penyelesainya. Staf: dropdown — In Progress memindahkan ke List Job. */}
                      <td>{readOnly ? `${r.status}${r.completedBy ? ` — ${r.completedBy}` : ''}` : statusSelect(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {!readOnly && (
        <section aria-label="List Job">
          <h2 className="section-title">List Job — Sedang Dikerjakan</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {jobRows.length === 0 ? (
              <p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}>
                <ListChecks size={16} /> Belum ada pekerjaan berjalan — set work order di atas ke “In Progress” untuk mulai.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="joblist-table">
                  <thead>
                    <tr>
                      <th>Nomor</th>
                      <th>ID Joblist</th>
                      <th>Nama Task</th>
                      <th>PIC</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobRows.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>WO-{r.id}</td>
                        <td style={{ maxWidth: 320, whiteSpace: 'normal' }}>
                          {r.lokasiItem} — {r.deskripsi}
                        </td>
                        <td>{r.pic || '-'}</td>
                        <td>{statusSelect(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
