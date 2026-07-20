'use client';

import { useEffect, useState } from 'react';
import { DASHBOARD_ROLES, type DashboardRole } from '@/config/dashboard-access';

/* PORT dari `renderOwnerUsers()` public/app.js (Fase 4 langkah 4/5).

   Struktur & kelas dipertahankan (.sec-card, .tbl, .cell-select, .cell-btn,
   .status) agar CSS hasil port berlaku. Aksi memanggil endpoint yang sudah
   dibangun di Fase 3: /api/dashboard/users{,/approve,/disable}.

   Namespace yang dikelola panel ini adalah namespace DASHBOARD (`role`/`status`).
   Akses Ops dikelola terpisah di /ops/admin/users — dua kolom persetujuan
   digabung menjadi satu halaman pada Fase 5 (§5.2). */

interface Row {
  username: string;
  name: string;
  role: DashboardRole | null;
  status: 'pending' | 'active' | 'disabled';
  tfaEnabled: boolean;
  email: string | null;
}

const badgeClass = (s: Row['status']) =>
  s === 'active' ? 's-complete' : s === 'pending' ? 's-pending' : 's-progress';

export default function DashboardUserAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [pick, setPick] = useState<Record<string, DashboardRole>>({});

  const load = async () => {
    setErr('');
    try {
      const r = await fetch('/api/dashboard/users');
      if (!r.ok) {
        setErr((await r.json().catch(() => ({}))).error || 'Gagal memuat daftar akun.');
        setRows([]);
        return;
      }
      setRows(await r.json());
    } catch {
      setErr('Gagal memuat daftar akun.');
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (path: 'approve' | 'disable', username: string, role?: DashboardRole) => {
    setBusy(username);
    setErr('');
    try {
      const r = await fetch(`/api/dashboard/users/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(path === 'approve' ? { username, role } : { username })
      });
      if (!r.ok) setErr((await r.json().catch(() => ({}))).error || 'Aksi gagal.');
      else await load();
    } catch {
      setErr('Aksi gagal.');
    } finally {
      setBusy('');
    }
  };

  const RoleSelect = ({ u }: { u: Row }) => (
    <select
      className="cell-select sec-role"
      value={pick[u.username] || u.role || 'sales'}
      onChange={(e) => setPick((p) => ({ ...p, [u.username]: e.target.value as DashboardRole }))}
    >
      {DASHBOARD_ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );

  return (
    <section className="sec-card">
      <h3>
        Kelola Akun <small>(Owner)</small>
      </h3>
      {err && <p style={{ color: 'var(--red)' }}>{err}</p>}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="secUserRows">
            {rows === null ? (
              <tr>
                <td colSpan={5}>Memuat…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5}>Belum ada akun lain.</td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.username} data-u={u.username}>
                  <td>{u.name}</td>
                  <td className="cell-id">{u.username}</td>
                  <td>{u.role || '-'}</td>
                  <td>
                    <span className={`status ${badgeClass(u.status)}`}>{u.status}</span>
                  </td>
                  <td>
                    {u.status === 'pending' || u.status === 'disabled' ? (
                      <>
                        <RoleSelect u={u} />
                        <button
                          className="cell-btn sec-approve"
                          disabled={busy === u.username}
                          onClick={() => act('approve', u.username, pick[u.username] || u.role || 'sales')}
                        >
                          {u.status === 'pending' ? 'Setujui' : 'Aktifkan'}
                        </button>
                      </>
                    ) : (
                      <button
                        className="cell-btn sec-disable"
                        disabled={busy === u.username}
                        onClick={() => act('disable', u.username)}
                      >
                        Nonaktifkan
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
