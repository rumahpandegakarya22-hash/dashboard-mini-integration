'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle } from 'lucide-react';

export default function KontrakSettingPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    fetch('/api/ops/admin/kontrak')
      .then(async (res) => {
        const json = await res.json() as { enabled?: boolean; error?: string };
        if (!res.ok) throw new Error(json.error || 'Gagal memuat.');
        setEnabled(!!json.enabled);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Gagal memuat.'));
  }, []);

  // Tersimpan langsung saat saklar digeser; dikembalikan bila gagal.
  async function ubah(nilai: boolean) {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/ops/admin/kontrak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nilai }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
      setEnabled(nilai);
      setInfo(nilai ? 'Kontrak sewa sekarang tampil di formulir pendaftaran.' : 'Kontrak sewa disembunyikan dari formulir pendaftaran.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-col" style={{ maxWidth: 480 }}>
      {error && (
        <div className="banner error" role="alert">
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}
      {info && <div className="banner info" role="status"><span>{info}</span></div>}

      {enabled === null && !error && (
        <div className="card" aria-busy="true">
          <div className="skeleton" style={{ height: 20, width: '50%' }} />
        </div>
      )}

      {enabled !== null && (
        <div className="card form-col">
          <div className="switch-row">
            <div>
              <div className="switch-label">Tampilkan kontrak sewa di Teman Rara</div>
              <span className="muted" style={{ fontSize: '0.8rem' }}>
                Jika aktif, calon penghuni wajib membaca dan menyetujui kontrak sebelum mengirim pendaftaran.
                File: <code>kontrak-sewa.pdf</code> di folder Drive dokumen internal.
              </span>
            </div>
            <label className="switch" aria-label="Tampilkan kontrak sewa">
              <input
                type="checkbox"
                checked={enabled}
                disabled={busy}
                onChange={(e) => ubah(e.target.checked)}
              />
              <span className="track" />
              <span className="thumb" />
            </label>
          </div>
          {busy && <LoaderCircle size={18} className="spin" />}
        </div>
      )}
    </div>
  );
}
