'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, LoaderCircle, RotateCcw, UserRoundCheck, UserRoundX } from 'lucide-react';
import { ROLE_LABEL, type Role } from '@/lib/roles';

interface UserRow {
  id: string; // Clerk userId — kunci semua aksi
  username: string;
  name: string;
  role: Role | null;
  status: 'pending' | 'active' | 'disabled';
  authProvider: string;
  email?: string;
  createdAt: string;
}

const ROLES = Object.keys(ROLE_LABEL) as Role[];

export default function UserAdminPanel({ currentUserId }: { currentUserId: string }) {
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

  if (loading) {
    return (
      <div className="card" aria-busy="true" aria-label="Memuat daftar user">
        <div className="skeleton" style={{ height: 20, width: '45%' }} />
        <div className="skeleton" style={{ height: 52, marginTop: 14 }} />
        <div className="skeleton" style={{ height: 52, marginTop: 10 }} />
        <div className="skeleton" style={{ height: 52, marginTop: 10 }} />
      </div>
    );
  }

  const pending = users.filter((u) => u.status === 'pending');
  const active = users.filter((u) => u.status === 'active');
  const disabled = users.filter((u) => u.status === 'disabled');

  const initialOf = (name: string) => (name.trim()[0] || '?').toUpperCase();

  return (
    <div>
      {error && (
        <div className="banner error" role="alert" style={{ marginBottom: 12 }}>
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Menunggu Persetujuan <span className="count-badge">{pending.length}</span>
        </h2>
        {pending.length === 0 && (
          <p className="muted" style={{ marginTop: 8 }}>
            Tidak ada user menunggu persetujuan.
          </p>
        )}
        {pending.map((u) => (
          <div key={u.id} className="user-row">
            <span className="avatar" aria-hidden>
              {initialOf(u.name)}
            </span>
            <div className="user-meta">
              <div className="user-name">{u.name}</div>
              <div className="user-sub">{u.email}</div>
            </div>
            <div className="user-actions">
              <label htmlFor={`role-${u.id}`} className="sr-only">
                Role untuk {u.name}
              </label>
              <select
                id={`role-${u.id}`}
                value={pendingRole[u.id] || ''}
                onChange={(e) => setPendingRole((prev) => ({ ...prev, [u.id]: e.target.value as Role }))}
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
                className="btn compact"
                disabled={!pendingRole[u.id] || busy === u.id}
                onClick={() => callAction('approve', { id: u.id, role: pendingRole[u.id] }, u.id)}
              >
                {busy === u.id ? <LoaderCircle size={16} className="spin" /> : <UserRoundCheck size={16} />}
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          User Aktif <span className="count-badge">{active.length}</span>
        </h2>
        {active.map((u) => (
          <div key={u.id} className="user-row">
            <span className="avatar" aria-hidden>
              {initialOf(u.name)}
            </span>
            <div className="user-meta">
              <div className="user-name">
                {u.name}
                {u.id === currentUserId && <span className="muted"> (kamu)</span>}
              </div>
              <div className="user-sub">{u.username}</div>
            </div>
            <div className="user-actions">
              <label htmlFor={`role-active-${u.id}`} className="sr-only">
                Role {u.name}
              </label>
              <select
                id={`role-active-${u.id}`}
                value={u.role || ''}
                onChange={(e) => callAction('role', { id: u.id, role: e.target.value }, u.id)}
                disabled={busy === u.id}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              {u.id !== currentUserId && (
                <button
                  type="button"
                  className="btn-plain danger"
                  disabled={busy === u.id}
                  onClick={() => callAction('deactivate', { id: u.id }, u.id)}
                >
                  {busy === u.id ? <LoaderCircle size={16} className="spin" /> : <UserRoundX size={16} />}
                  Nonaktifkan
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {disabled.length > 0 && (
        <div className="card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Dinonaktifkan <span className="count-badge">{disabled.length}</span>
          </h2>
          {disabled.map((u) => (
            <div key={u.id} className="user-row">
              <span className="avatar" aria-hidden style={{ opacity: 0.55 }}>
                {initialOf(u.name)}
              </span>
              <div className="user-meta">
                <div className="user-name">{u.name}</div>
                <div className="user-sub">{u.username}</div>
              </div>
              <div className="user-actions">
                <button
                  type="button"
                  className="btn-plain"
                  disabled={busy === u.id}
                  onClick={() => callAction('reactivate', { id: u.id }, u.id)}
                >
                  {busy === u.id ? <LoaderCircle size={16} className="spin" /> : <RotateCcw size={16} />}
                  Aktifkan lagi
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
