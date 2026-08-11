'use client';

import { useEffect, useState } from 'react';

interface RiwayatRow {
  id: number;
  periode: string;
  jenis: string;
  nama_file: string;
  drive_url: string | null;
  dibuat_oleh: string | null;
  created_at: string;
}

type Jenis = 'Cashflow' | 'LabaRugi' | 'Neraca';

function bulanIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} style={{ padding: '8px 12px' }}>
          <div style={{ height: 14, borderRadius: 4, background: 'var(--color-skeleton, #e0e0e0)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

export default function LaporanKeuanganPanel() {
  const [riwayat, setRiwayat] = useState<RiwayatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailTo, setEmailTo] = useState('');
  const [periodeInput, setPeriodeInput] = useState(bulanIni());
  const [generating, setGenerating] = useState<Jenis | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/ops/admin/laporan-keuangan');
      if (!res.ok) throw new Error('Gagal memuat data.');
      const data = await res.json() as { riwayat: RiwayatRow[]; emailTo: string | null };
      setRiwayat(data.riwayat);
      setEmailTo(data.emailTo ?? '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, []);

  async function simpanEmail() {
    setSavingEmail(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/ops/admin/laporan-keuangan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailTo }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan email.');
      setSuccess('Email tujuan disimpan.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan email.');
    } finally {
      setSavingEmail(false);
    }
  }

  async function generate(jenis: Jenis) {
    setGenerating(jenis);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/ops/admin/laporan-keuangan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periode: periodeInput, jenis, emailTo: emailTo || undefined }),
      });
      const data = await res.json() as { ok?: boolean; namaFile?: string; driveUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Gagal generate laporan.');
      setSuccess(`Laporan "${data.namaFile}" berhasil dibuat.${data.driveUrl ? ' Tersimpan di Drive.' : ''}`);
      void fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal generate laporan.');
    } finally {
      setGenerating(null);
    }
  }

  const JENIS_LIST: { jenis: Jenis; label: string }[] = [
    { jenis: 'Cashflow', label: 'Generate Arus Kas' },
    { jenis: 'LabaRugi', label: 'Generate Laba Rugi' },
    { jenis: 'Neraca', label: 'Generate Neraca' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Banner sukses/error */}
      {error && (
        <div className="banner error" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Tutup" style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button>
        </div>
      )}
      {success && (
        <div className="banner info" role="status">
          {success}
          <button onClick={() => setSuccess(null)} aria-label="Tutup" style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* Setting email */}
      <div className="bento-card">
        <h2 style={{ fontWeight: 600, fontSize: '1em', marginBottom: 12 }}>Email Tujuan Laporan</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="email"
            className="input"
            placeholder="contoh@email.com"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <button
            className="btn secondary"
            onClick={() => void simpanEmail()}
            disabled={savingEmail}
          >
            {savingEmail ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: '0.85em' }}>
          Kosongkan untuk tidak mengirim email saat generate laporan.
        </p>
      </div>

      {/* Picker periode + tombol generate */}
      <div className="bento-card">
        <h2 style={{ fontWeight: 600, fontSize: '1em', marginBottom: 12 }}>Generate Laporan</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9em' }}>
            Periode
          </label>
          <input
            type="month"
            className="input"
            value={periodeInput}
            onChange={(e) => setPeriodeInput(e.target.value)}
            style={{ maxWidth: 200 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {JENIS_LIST.map(({ jenis, label }) => (
            <button
              key={jenis}
              className="btn"
              onClick={() => void generate(jenis)}
              disabled={generating !== null || !periodeInput}
            >
              {generating === jenis ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="spinner" style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  Memproses…
                </span>
              ) : label}
            </button>
          ))}
        </div>
      </div>

      {/* Riwayat laporan */}
      <div className="bento-card">
        <h2 style={{ fontWeight: 600, fontSize: '1em', marginBottom: 12 }}>Riwayat Laporan</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: '0.9em' }}>
            <thead>
              <tr>
                <th>Periode</th>
                <th>Jenis</th>
                <th>Nama File</th>
                <th>Tanggal Generate</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : riwayat.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)' }}>
                    Belum ada riwayat laporan.
                  </td>
                </tr>
              ) : (
                riwayat.map((r) => (
                  <tr key={r.id}>
                    <td>{r.periode}</td>
                    <td>{r.jenis}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{r.nama_file}</td>
                    <td>{r.created_at.slice(0, 16).replace('T', ' ')}</td>
                    <td>
                      {r.drive_url ? (
                        <a href={r.drive_url} target="_blank" rel="noopener noreferrer" className="btn secondary">
                          Buka File
                        </a>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.85em' }}>Tidak tersedia</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
