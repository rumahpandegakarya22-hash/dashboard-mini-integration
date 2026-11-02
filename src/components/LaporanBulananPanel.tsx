'use client';

import { useEffect, useState } from 'react';
import { adalahBulanBerjalan, kodeBulanJakarta, kodeBulanLalu } from '@/lib/laporan-bulanan/periode';
import { waktuRiwayatWib } from '@/lib/laporan-bulanan/format';

interface LaporanItem {
  id: string;
  judul: string;
  keluarga: 'kerja' | 'kinerja' | 'owner';
}

interface RiwayatRow {
  id: number;
  periode: string;
  jenis: string;
  nama_file: string;
  drive_url: string | null;
  dibuat_oleh: string | null;
  created_at: string;
}

const KELUARGA: { kunci: LaporanItem['keluarga']; judul: string }[] = [
  { kunci: 'kerja', judul: 'Kerja divisi' },
  { kunci: 'kinerja', judul: 'Kinerja divisi' },
  { kunci: 'owner', judul: 'Owner' },
];

const tombolKecil = { padding: '4px 10px', fontSize: '0.8em' } as const;

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} style={{ padding: '8px 12px' }}>
          <div style={{ height: 14, borderRadius: 4, background: 'var(--color-skeleton, #e0e0e0)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

function urlPdf(id: string, periode: string, format: 'pdf' | 'html'): string {
  return `/api/ops/admin/laporan-bulanan/pdf?id=${encodeURIComponent(id)}&periode=${encodeURIComponent(periode)}&format=${format}`;
}

export default function LaporanBulananPanel() {
  const [laporan, setLaporan] = useState<LaporanItem[]>([]);
  const [riwayat, setRiwayat] = useState<RiwayatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState(() => kodeBulanLalu(new Date()));
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/ops/admin/laporan-bulanan');
      const data = await res.json() as { laporan?: LaporanItem[]; riwayat?: RiwayatRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Gagal memuat data.');
      setLaporan(data.laporan ?? []);
      setRiwayat(data.riwayat ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, []);

  async function generate(item: LaporanItem) {
    setGenerating(item.id);
    setError(null);
    setSuccess(null);
    setDriveUrl(null);
    try {
      const res = await fetch('/api/ops/admin/laporan-bulanan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, periode }),
      });
      const data = await res.json() as { namaFile?: string; driveUrl?: string | null; catatanArsip?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Gagal membuat laporan.');
      setSuccess(data.catatanArsip
        ? `Laporan "${data.namaFile}" dibuat. ${data.catatanArsip}`
        : `Laporan "${data.namaFile}" berhasil dibuat dan diarsipkan.`);
      setDriveUrl(data.driveUrl ?? null);
      void fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal membuat laporan.');
    } finally {
      setGenerating(null);
    }
  }

  const judulById = new Map(laporan.map((l) => [l.id, l.judul]));
  const sibuk = generating !== null;
  const periodeOk = /^\d{4}-\d{2}$/.test(periode);
  const berjalan = periodeOk && adalahBulanBerjalan(periode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {error && (
        <div className="banner error" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Tutup" style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button>
        </div>
      )}
      {success && (
        <div className="banner info" role="status">
          {success}
          {driveUrl && (
            <> <a href={driveUrl} target="_blank" rel="noopener noreferrer">Buka di Drive</a></>
          )}
          <button onClick={() => setSuccess(null)} aria-label="Tutup" style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button>
        </div>
      )}

      <div className="bento-card">
        <h2 style={{ fontWeight: 600, fontSize: '1em', marginBottom: 12 }}>Laporan Bulanan Divisi</h2>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="periode-bulanan" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9em' }}>
            Periode
          </label>
          <input
            id="periode-bulanan"
            type="month"
            className="input"
            value={periode}
            max={kodeBulanJakarta(new Date())}
            onChange={(e) => setPeriode(e.target.value)}
            style={{ maxWidth: 200 }}
          />
          {berjalan && (
            <p className="muted" style={{ marginTop: 6, fontSize: '0.85em' }}>
              Bulan berjalan belum selesai: hanya Pratinjau dan Unduh PDF. Generate &amp; Arsipkan tersedia setelah bulan berakhir.
            </p>
          )}
        </div>

        {loading ? (
          <p className="muted">Memuat daftar laporan…</p>
        ) : laporan.length === 0 ? (
          <p className="muted">Tidak ada laporan yang tersedia untuk peran Anda.</p>
        ) : (
          KELUARGA.map(({ kunci, judul }) => {
            const items = laporan.filter((l) => l.keluarga === kunci);
            if (items.length === 0) return null;
            return (
              <section key={kunci} style={{ marginBottom: 16 }}>
                <h3 style={{ fontWeight: 600, fontSize: '0.9em', marginBottom: 8 }}>{judul}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((l) => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                      <span style={{ flex: '1 1 200px', minWidth: 0 }}>{l.judul}</span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <a
                          href={periodeOk ? urlPdf(l.id, periode, 'html') : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn secondary"
                          style={{ ...tombolKecil, ...(!periodeOk || sibuk ? { pointerEvents: 'none', opacity: 0.5 } : {}) }}
                          aria-disabled={!periodeOk || sibuk}
                        >
                          Pratinjau
                        </a>
                        <a
                          href={periodeOk ? urlPdf(l.id, periode, 'pdf') : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn secondary"
                          style={{ ...tombolKecil, ...(!periodeOk || sibuk ? { pointerEvents: 'none', opacity: 0.5 } : {}) }}
                          aria-disabled={!periodeOk || sibuk}
                        >
                          Unduh PDF
                        </a>
                        <button
                          className="btn"
                          style={tombolKecil}
                          onClick={() => void generate(l)}
                          disabled={sibuk || !periodeOk || berjalan}
                          title={berjalan ? 'Bulan berjalan belum selesai' : undefined}
                        >
                          {generating === l.id ? 'Memproses…' : 'Generate & Arsipkan'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      <div className="bento-card">
        <h2 style={{ fontWeight: 600, fontSize: '1em', marginBottom: 12 }}>Riwayat Laporan Bulanan</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', fontSize: '0.9em' }}>
            <thead>
              <tr>
                <th>Periode</th>
                <th>Laporan</th>
                <th>Nama berkas</th>
                <th>Dibuat oleh</th>
                <th>Waktu</th>
                <th>Drive</th>
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
                  <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)' }}>
                    Belum ada riwayat laporan bulanan.
                  </td>
                </tr>
              ) : (
                riwayat.map((r) => (
                  <tr key={r.id}>
                    <td>{r.periode}</td>
                    <td>{judulById.get(r.jenis) ?? r.jenis}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{r.nama_file}</td>
                    <td>{r.dibuat_oleh ?? '-'}</td>
                    <td>{waktuRiwayatWib(r.created_at)}</td>
                    <td>
                      {r.drive_url ? (
                        <a href={r.drive_url} target="_blank" rel="noopener noreferrer" className="btn secondary" style={tombolKecil}>
                          Buka Drive
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
