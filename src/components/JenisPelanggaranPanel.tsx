'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, Plus, Trash2 } from 'lucide-react';

const API = '/api/ops/admin/jenis-pelanggaran';

export default function JenisPelanggaranPanel() {
  const [daftar, setDaftar] = useState<string[] | null>(null);
  const [baru, setBaru] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function panggil(method: 'GET' | 'POST' | 'DELETE', nilai?: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(API, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: nilai === undefined ? undefined : JSON.stringify({ nilai })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memproses.');
      setDaftar(json.data);
      if (method === 'POST') setBaru('');
    } catch (e: any) {
      setError(e.message || 'Gagal memproses.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    panggil('GET');
  }, []);

  return (
    <div className="card">
      {error && (
        <div className="banner error" role="alert" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <form
        className="btn-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (baru.trim()) panggil('POST', baru);
        }}
      >
        <input
          aria-label="Nama jenis pelanggaran baru"
          placeholder="Nama jenis, mis. Kebisingan"
          maxLength={60}
          value={baru}
          onChange={(e) => setBaru(e.target.value)}
          style={{ flex: 1, maxWidth: 360 }}
        />
        <button type="submit" className="btn" disabled={busy || !baru.trim()}>
          {busy ? <LoaderCircle size={18} className="spin" /> : <Plus size={18} />}
          Tambah
        </button>
      </form>

      {daftar === null && <div className="skeleton" style={{ height: 56, marginTop: 14 }} aria-busy="true" />}

      <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0' }}>
        {daftar?.map((j) => (
          <li key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border, #e5e5e5)' }}>
            <span style={{ flex: 1 }}>{j}</span>
            <button
              type="button"
              className="btn-plain"
              aria-label={`Hapus jenis ${j}`}
              disabled={busy || daftar.length <= 1}
              onClick={() => panggil('DELETE', j)}
            >
              <Trash2 size={16} />
              Hapus
            </button>
          </li>
        ))}
      </ul>

      <p className="muted" style={{ fontSize: '0.8125rem', marginTop: 12 }}>
        Menghapus jenis hanya menyembunyikannya dari pilihan baru; pelanggaran yang sudah tercatat tidak berubah. Minimal satu jenis harus tersisa.
      </p>
    </div>
  );
}
