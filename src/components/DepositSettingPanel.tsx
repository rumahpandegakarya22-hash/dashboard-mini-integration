'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle } from 'lucide-react';

interface DepositConfig { enabled: boolean; nominal: number; }

export default function DepositSettingPanel() {
  const [data, setData] = useState<DepositConfig | null>(null);
  const [draft, setDraft] = useState<DepositConfig>({ enabled: false, nominal: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/ops/admin/deposit');
      const json = await res.json() as DepositConfig & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Gagal memuat.');
      setData(json);
      setDraft(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat.');
    }
  }

  useEffect(() => { load(); }, []);

  async function simpan() {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/ops/admin/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
      setInfo('Setting deposit tersimpan.');
      setData(draft);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  }

  const berubah = data && (draft.enabled !== data.enabled || draft.nominal !== data.nominal);

  return (
    <div className="form-col" style={{ maxWidth: 480 }}>
      {error && (
        <div className="banner error" role="alert">
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}
      {info && <div className="banner info" role="status"><span>{info}</span></div>}

      {data === null && !error && (
        <div className="card" aria-busy="true">
          <div className="skeleton" style={{ height: 20, width: '50%' }} />
          <div className="skeleton" style={{ height: 40, marginTop: 12 }} />
        </div>
      )}

      {data !== null && (
        <>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
              />
              Aktifkan fitur deposit
            </label>
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              Jika aktif, field deposit muncul di pendaftaran penghuni baru.
            </span>
          </div>

          <div className="field">
            <label htmlFor="deposit-nominal">Nominal Deposit (Rp)</label>
            <input
              id="deposit-nominal"
              type="number"
              min={0}
              step={50000}
              value={draft.nominal}
              onChange={(e) => setDraft((d) => ({ ...d, nominal: Number(e.target.value) }))}
              disabled={!draft.enabled}
            />
          </div>

          <button
            type="button"
            className="btn"
            disabled={busy || !berubah}
            onClick={simpan}
          >
            {busy && <LoaderCircle size={18} className="spin" />}
            Simpan
          </button>
        </>
      )}
    </div>
  );
}
