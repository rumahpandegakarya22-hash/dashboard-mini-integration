'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle } from 'lucide-react';

interface Pemicu { sumber: string; ref: string; alasan: string; oleh: string; sejak: string }
interface Kamar { no: string; tipe: string; status: string; penghuni: string; pemicu: Pemicu[] }

const NAMA_SUMBER: Record<string, string> = {
  manual: 'Tombol manual',
  pengaduan: 'Pengaduan Teman Rara',
  inspeksi: 'Inspeksi checkout',
  work_order: 'Work order'
};

export default function StatusKamarPanel() {
  const [rows, setRows] = useState<Kamar[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [alasanDi, setAlasanDi] = useState<string | null>(null);
  const [alasan, setAlasan] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/ops/admin/status-kamar');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat status kamar.');
      setRows(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat status kamar.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function kirim(no: string, aksi: 'mulai' | 'selesai') {
    setBusy(no);
    setError('');
    setOk('');
    try {
      const res = await fetch('/api/ops/admin/status-kamar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_kamar: no, aksi, alasan })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengubah status kamar.');
      setOk(`Kamar ${no} sekarang ${json.status}.`);
      setAlasanDi(null);
      setAlasan('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status kamar.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="muted"><LoaderCircle size={16} className="spin" aria-hidden /> Memuat…</p>;

  return (
    <>
      {error && <p className="error"><CircleAlert size={16} aria-hidden /> {error}</p>}
      {ok && <p className="muted">{ok}</p>}

      <div className="card">
        <p className="muted" style={{ marginBottom: 4 }}>
          Kamar otomatis <b>Maintenance</b> saat ada pengaduan kerusakan yang diproses, temuan inspeksi checkout,
          atau work order Maintenance untuk kamar itu. Kamar kembali sendiri setelah semua pemicunya selesai
          (Terisi bila ada penghuni, Booking bila ada booking yang belum check-in, selain itu Kosong).
        </p>
        <p className="muted">
          Tombol <b>Selesai Maintenance</b> menutup semua pemicu kamar itu sekaligus. Pakai hanya bila pemicu otomatisnya sudah beres.
        </p>
      </div>

      <div className="card" style={{ marginTop: 14, overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr><th>Kamar</th><th>Tipe</th><th>Status</th><th>Penghuni</th><th>Pemicu Maintenance</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const maint = r.status.toLowerCase() === 'maintenance';
              return (
                <tr key={r.no}>
                  <td>{r.no}</td>
                  <td>{r.tipe}</td>
                  <td><span className="badge">{r.status || '—'}</span></td>
                  <td>{r.penghuni || '—'}</td>
                  <td>
                    {r.pemicu.length === 0 ? '—' : r.pemicu.map((p, i) => (
                      <div key={i}>
                        <b>{NAMA_SUMBER[p.sumber] ?? p.sumber}</b>
                        {p.alasan ? ` — ${p.alasan}` : ''} <small className="muted">(sejak {p.sejak})</small>
                      </div>
                    ))}
                  </td>
                  <td>
                    {maint ? (
                      <button
                        className="btn-plain"
                        disabled={busy === r.no}
                        onClick={() => {
                          if (window.confirm(`Selesaikan Maintenance kamar ${r.no}? Semua pemicu kamar ini akan ditutup.`)) kirim(r.no, 'selesai');
                        }}
                      >
                        {busy === r.no ? 'Memproses…' : 'Selesai Maintenance'}
                      </button>
                    ) : alasanDi === r.no ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
                        <input
                          type="text"
                          maxLength={200}
                          value={alasan}
                          onChange={(e) => setAlasan(e.target.value)}
                          placeholder="Alasan Maintenance (wajib)"
                          aria-label={`Alasan Maintenance kamar ${r.no}`}
                        />
                        <div className="btn-row">
                          <button className="btn" disabled={busy === r.no || !alasan.trim()} onClick={() => kirim(r.no, 'mulai')}>
                            {busy === r.no ? 'Memproses…' : 'Simpan'}
                          </button>
                          <button className="btn-plain" onClick={() => { setAlasanDi(null); setAlasan(''); }}>Batal</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn-plain" onClick={() => { setAlasanDi(r.no); setAlasan(''); }}>
                        Tandai Maintenance
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
