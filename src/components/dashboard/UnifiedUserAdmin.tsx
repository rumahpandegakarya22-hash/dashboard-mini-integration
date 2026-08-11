'use client';

import { useEffect, useState } from 'react';
import { DASHBOARD_ROLES, type DashboardRole } from '@/config/dashboard-access';
import { ROLE_LABEL, type Role as OpsRole } from '@/lib/core/roles';
import OriginSelect from '@/components/ui/OriginSelect';


interface DashRow {
  username: string;
  name: string;
  role: DashboardRole | null;
  status: 'pending' | 'active' | 'disabled';
  tfaEnabled: boolean;
  email: string | null;
}

interface OpsRow {
  id: string;
  username: string;
  name: string;
  role: OpsRole | null;
  status: 'pending' | 'active' | 'disabled';
  email?: string;
}

interface Merged {
  username: string;
  name: string;
  email: string | null;
  tfaEnabled: boolean;
  dash?: DashRow;
  ops?: OpsRow;
}

const badgeClass = (s?: string) =>
  s === 'active' ? 's-complete' : s === 'pending' ? 's-pending' : 's-progress';

const StatusCell = ({ status }: { status?: string }) =>
  status ? <span className={`status ${badgeClass(status)}`}>{status}</span> : <span className="muted">—</span>;

export default function UnifiedUserAdmin() {
  const [rows, setRows] = useState<Merged[] | null>(null);
  const [dashErr, setDashErr] = useState('');
  const [opsErr, setOpsErr] = useState('');
  const [busy, setBusy] = useState('');
  const [pickDash, setPickDash] = useState<Record<string, DashboardRole>>({});
  const [pickOps, setPickOps] = useState<Record<string, OpsRole>>({});

  const load = async () => {
    setDashErr('');
    setOpsErr('');

    const [dashRes, opsRes] = await Promise.allSettled([
      fetch('/api/dashboard/users').then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) })),
      fetch('/api/ops/admin/users').then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
    ]);

    let dash: DashRow[] = [];
    let ops: OpsRow[] = [];

    if (dashRes.status === 'fulfilled' && dashRes.value.ok) dash = dashRes.value.body as DashRow[];
    else setDashErr(
      (dashRes.status === 'fulfilled' && (dashRes.value.body as any)?.error) || 'Tidak punya akses kelola akun Dashboard.'
    );

    if (opsRes.status === 'fulfilled' && opsRes.value.ok) ops = ((opsRes.value.body as any)?.data || []) as OpsRow[];
    else setOpsErr(
      (opsRes.status === 'fulfilled' && (opsRes.value.body as any)?.error) || 'Tidak punya akses kelola akun Ops.'
    );

    const byUser = new Map<string, Merged>();
    const put = (username: string, patch: Partial<Merged>) => {
      const cur = byUser.get(username) || { username, name: '', email: null, tfaEnabled: false };
      byUser.set(username, { ...cur, ...patch, name: patch.name || cur.name });
    };
    for (const d of dash)
      put(d.username, { name: d.name, email: d.email, tfaEnabled: d.tfaEnabled, dash: d });
    for (const o of ops) put(o.username, { name: o.name, email: o.email ?? null, ops: o });

    setRows([...byUser.values()].sort((a, b) => a.username.localeCompare(b.username, 'id')));
  };

  useEffect(() => {
    load();
  }, []);

  const call = async (url: string, body: unknown, key: string) => {
    setBusy(key);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        alert(e.error || 'Aksi gagal.');
      } else await load();
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="sec-card">
      <h3>
        Kelola Akun <small>(Owner — Dashboard &amp; Ops)</small>
      </h3>
      <p className="muted" style={{ marginBottom: 10 }}>
        Autorisasi Akses Dashboard dan Ops diberikan terpisah.
      </p>
      {dashErr && <p style={{ color: 'var(--amber)' }}>Dashboard: {dashErr}</p>}
      {opsErr && <p style={{ color: 'var(--amber)' }}>Ops: {opsErr}</p>}

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Username</th>
              <th>Akses Dashboard</th>
              <th>Akses Ops</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={4}>Memuat…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4}>Belum ada akun.</td>
              </tr>
            ) : (
              rows.map((u) => {
                const dKey = 'd:' + u.username;
                const oKey = 'o:' + u.username;
                return (
                  <tr key={u.username}>
                    <td>
                      {u.name}
                      {u.tfaEnabled && <small className="muted"> · 2FA</small>}
                    </td>
                    <td className="cell-id">{u.username}</td>

                    {/* ---- kolom Dashboard ---- */}
                    <td>
                      {!u.dash ? (
                        <span className="muted">—</span>
                      ) : (
                        <>
                          <StatusCell status={u.dash.status} />{' '}
                          <span className="muted">{u.dash.role || 'tanpa role'}</span>
                          <div style={{ marginTop: 6 }}>
                            {u.dash.status === 'active' ? (
                              <button
                                className="cell-btn"
                                disabled={busy === dKey}
                                onClick={() => call('/api/dashboard/users/disable', { username: u.username }, dKey)}
                              >
                                Nonaktifkan
                              </button>
                            ) : (
                              <>
                                <OriginSelect
                                  className="cell-select"
                                  ariaLabel="Role dashboard"
                                  value={pickDash[u.username] || u.dash.role || 'sales'}
                                  onChange={(v) =>
                                    setPickDash((p) => ({ ...p, [u.username]: v as DashboardRole }))
                                  }
                                  options={DASHBOARD_ROLES.map((r) => ({ value: r, label: r }))}
                                />
                                <button
                                  className="cell-btn"
                                  disabled={busy === dKey}
                                  onClick={() =>
                                    call(
                                      '/api/dashboard/users/approve',
                                      {
                                        username: u.username,
                                        role: pickDash[u.username] || u.dash!.role || 'sales'
                                      },
                                      dKey
                                    )
                                  }
                                >
                                  {u.dash.status === 'pending' ? 'Setujui' : 'Aktifkan'}
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </td>

                    {/* ---- kolom Ops ---- */}
                    <td>
                      {!u.ops ? (
                        <span className="muted">—</span>
                      ) : (
                        <>
                          <StatusCell status={u.ops.status} />{' '}
                          <span className="muted">
                            {u.ops.role ? ROLE_LABEL[u.ops.role] : 'tanpa role'}
                          </span>
                          <div style={{ marginTop: 6 }}>
                            {u.ops.status === 'active' ? (
                              <button
                                className="cell-btn"
                                disabled={busy === oKey}
                                onClick={() => call('/api/ops/admin/users/deactivate', { id: u.ops!.id }, oKey)}
                              >
                                Nonaktifkan
                              </button>
                            ) : (
                              <>
                                <OriginSelect
                                  className="cell-select"
                                  ariaLabel="Role ops"
                                  value={pickOps[u.username] || u.ops.role || 'staff_admin'}
                                  onChange={(v) =>
                                    setPickOps((p) => ({ ...p, [u.username]: v as OpsRole }))
                                  }
                                  options={(Object.keys(ROLE_LABEL) as OpsRole[]).map((r) => ({
                                    value: r,
                                    label: ROLE_LABEL[r]
                                  }))}
                                />
                                <button
                                  className="cell-btn"
                                  disabled={busy === oKey}
                                  onClick={() =>
                                    call(
                                      u.ops!.status === 'pending'
                                        ? '/api/ops/admin/users/approve'
                                        : '/api/ops/admin/users/reactivate',
                                      {
                                        id: u.ops!.id,
                                        role: pickOps[u.username] || u.ops!.role || 'staff_admin'
                                      },
                                      oKey
                                    )
                                  }
                                >
                                  {u.ops.status === 'pending' ? 'Setujui' : 'Aktifkan'}
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
