'use client';

import { useEffect, useState } from 'react';
import { ROLE_LABEL, type Role } from '@/lib/roles';

interface UserRow {
  username: string;
  name: string;
  role: Role | null;
  status: 'pending' | 'active' | 'disabled';
  authProvider: 'password' | 'google';
  email?: string;
  createdAt: string;
}

const ROLES = Object.keys(ROLE_LABEL) as Role[];

export default function UserAdminPanel({ currentUsername }: { currentUsername: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingRole, setPendingRole] = useState<Record<string, Role>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat daftar user.');
      setUsers(json.data);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat daftar user.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function callAction(path: string, body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Gagal.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="muted">Memuat...</p>;

  const pending = users.filter((u) => u.status === 'pending');
  const active = users.filter((u) => u.status === 'active');
  const disabled = users.filter((u) => u.status === 'disabled');

  return (
    <div>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2>Menunggu Persetujuan ({pending.length})</h2>
        {pending.length === 0 && <p className="muted">Tidak ada user menunggu persetujuan.</p>}
        {pending.map((u) => (
          <div key={u.username} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
            <div>
              <strong>{u.name}</strong> — <span className="muted">{u.email}</span>
            </div>
            <label htmlFor={`role-${u.username}`}>Role</label>
            <select
              id={`role-${u.username}`}
              value={pendingRole[u.username] || ''}
              onChange={(e) => setPendingRole((prev) => ({ ...prev, [u.username]: e.target.value as Role }))}
            >
              <option value="">Pilih role...</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!pendingRole[u.username] || busy === u.username}
              onClick={() => callAction('approve', { username: u.username, role: pendingRole[u.username] }, u.username)}
            >
              {busy === u.username ? 'Memproses...' : 'Approve'}
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>User Aktif ({active.length})</h2>
        {active.map((u) => (
          <div key={u.username} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
            <div>
              <strong>{u.name}</strong> — <span className="muted">{u.username}</span>
              {u.username === currentUsername && <span className="muted"> (kamu)</span>}
            </div>
            <select
              value={u.role || ''}
              onChange={(e) => callAction('role', { username: u.username, role: e.target.value }, u.username)}
              disabled={busy === u.username}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            {u.username !== currentUsername && (
              <button
                type="button"
                className="btn-link"
                disabled={busy === u.username}
                onClick={() => callAction('deactivate', { username: u.username }, u.username)}
              >
                Nonaktifkan
              </button>
            )}
          </div>
        ))}
      </div>

      {disabled.length > 0 && (
        <div className="card">
          <h2>Dinonaktifkan ({disabled.length})</h2>
          {disabled.map((u) => (
            <div key={u.username} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
              <div>
                <strong>{u.name}</strong> — <span className="muted">{u.username}</span>
              </div>
              <button
                type="button"
                className="btn-link"
                disabled={busy === u.username}
                onClick={() => callAction('reactivate', { username: u.username }, u.username)}
              >
                Aktifkan lagi
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
