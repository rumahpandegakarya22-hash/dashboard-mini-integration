'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, MessageSquare } from 'lucide-react';

type Row = {
  no_booking: string;
  id_penghuni: string;
  nama_penyewa: string;
  kamar_no: number | string;
  tgl_masuk: string;
  no_hp: string;
  status_booking: string;
  kk_id: number | null;
  status_checkin: string | null;
};

const BADGE: Record<string, { label: string; color: string }> = {
  Belum: { label: 'Belum', color: '#6b7280' },
  Menunggu: { label: 'Menunggu', color: '#d97706' },
  Disetujui: { label: 'Disetujui', color: '#16a34a' },
};

function badgeFor(status: string | null): { label: string; color: string } {
  if (status === 'Menunggu') return BADGE.Menunggu;
  if (status === 'Disetujui') return BADGE.Disetujui;
  return BADGE.Belum;
}

function waHref(noHp: string): string {
  const digits = noHp.replace(/\D/g, '').replace(/^0/, '');
  return `https://wa.me/62${digits}`;
}

export default function DaftarBookingPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/ops/admin/daftar-booking');
      const json = await res.json() as { data: Row[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Gagal memuat data.');
      setRows(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCheckin(row: Row) {
    const ok = window.confirm(`Konfirmasi check-in untuk ${row.nama_penyewa}?`);
    if (!ok) return;
    setActionLoading(row.no_booking);
    try {
      const res = await fetch('/api/ops/admin/daftar-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_booking: row.no_booking }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Gagal check-in.');
      // Hapus baris dari list setelah check-in berhasil
      setRows((prev) => prev?.filter((r) => r.no_booking !== row.no_booking) ?? prev);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Gagal check-in.');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="banner error" role="alert" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {rows === null && !error && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr>
                {['No. Kamar', 'Nama Penyewa', 'Tgl Masuk', 'No HP', 'Status Inspeksi', 'Aksi'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((i) => (
                <tr key={i}>
                  {[60, 120, 80, 90, 70, 100].map((w, j) => (
                    <td key={j} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)' }}>
                      <div className="skeleton" style={{ height: 14, width: w }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows?.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Tidak ada booking yang menunggu check-in.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr>
                {['No. Kamar', 'Nama Penyewa', 'Tgl Masuk', 'No HP', 'Status Inspeksi', 'Aksi'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const badge = badgeFor(row.status_checkin);
                const isApproved = row.status_checkin === 'Disetujui';
                const isLoading = actionLoading === row.no_booking;
                return (
                  <tr key={row.no_booking}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)', whiteSpace: 'nowrap' }}>
                      {row.kamar_no}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)' }}>
                      {row.nama_penyewa}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)', whiteSpace: 'nowrap' }}>
                      {row.tgl_masuk}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)', whiteSpace: 'nowrap' }}>
                      {row.no_hp}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: badge.color,
                        border: `1px solid ${badge.color}`,
                        borderRadius: 4,
                        padding: '2px 6px',
                        whiteSpace: 'nowrap',
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle, #f0f0f0)' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          disabled={!isApproved || isLoading}
                          title={!isApproved ? 'Inspeksi belum disetujui' : undefined}
                          onClick={() => handleCheckin(row)}
                        >
                          {isLoading
                            ? <LoaderCircle size={14} className="spin" />
                            : 'Check-in'}
                        </button>
                        <a
                          href={waHref(row.no_hp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn secondary"
                          style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title="WhatsApp"
                        >
                          <MessageSquare size={13} />
                          WA
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
