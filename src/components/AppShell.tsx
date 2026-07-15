'use client';

// Chrome adaptif "Liquid Glass":
//  - < 900px : top bar kaca mengambang + dock kaca di bawah (operasi satu jempol)
//  - ≥ 900px : sidebar kaca dengan navigasi modul per divisi
// Konten selalu di permukaan solid — kaca hanya untuk chrome ini.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { ChevronLeft, House, LoaderCircle, LogOut, ShieldCheck, Users } from 'lucide-react';
import { DIVISION_GROUPS, moduleIcon } from './module-icons';

export interface NavModule {
  id: string;
  title: string;
}

interface Props {
  userName: string;
  roleLabel: string;
  isOwner: boolean;
  modules: NavModule[];
  children: React.ReactNode;
}

export default function AppShell({ userName, roleLabel, isOwner, modules, children }: Props) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const [loggingOut, setLoggingOut] = useState(false);

  const isHome = pathname === '/';
  const isAdmin = pathname.startsWith('/admin');
  const isAccount = pathname.startsWith('/account');
  const activeModule = modules.find((m) => pathname === `/m/${m.id}`);
  const topTitle = isHome
    ? 'Kost Tiga Dara'
    : isAdmin
      ? 'Kelola User'
      : isAccount
        ? 'Keamanan Akun'
        : activeModule?.title ?? 'Kost Tiga Dara';
  const initial = (userName.trim()[0] || '?').toUpperCase();

  const groups = DIVISION_GROUPS.map((g) => ({
    label: g.label,
    items: g.ids.map((id) => modules.find((m) => m.id === id)).filter((m): m is NavModule => !!m)
  })).filter((g) => g.items.length > 0);

  async function logout() {
    setLoggingOut(true);
    try {
      await signOut({ redirectUrl: '/login' });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="shell">
      {/* ---- Sidebar (desktop) ---- */}
      <aside className="sidebar">
        <div className="side-brand">
          <span className="icon-tile" aria-hidden>
            <House size={20} />
          </span>
          <div>
            <div className="side-brand-name">Kost Tiga Dara</div>
            <div className="side-brand-sub">Mini App Operasional</div>
          </div>
        </div>

        <nav aria-label="Navigasi utama">
          <Link href="/" className={isHome ? 'side-item active' : 'side-item'}>
            <House size={18} />
            Beranda
          </Link>

          {groups.map((g) => (
            <div key={g.label}>
              {groups.length > 1 && <div className="side-group-label">{g.label}</div>}
              {g.items.map((m) => {
                const Icon = moduleIcon(m.id);
                const active = pathname === `/m/${m.id}`;
                return (
                  <Link key={m.id} href={`/m/${m.id}`} className={active ? 'side-item active' : 'side-item'}>
                    <Icon size={18} />
                    {m.title}
                  </Link>
                );
              })}
            </div>
          ))}

          {isOwner && (
            <div>
              <div className="side-group-label">Admin</div>
              <Link href="/admin/users" className={isAdmin ? 'side-item active' : 'side-item'}>
                <Users size={18} />
                Kelola User
              </Link>
            </div>
          )}
        </nav>

        <div className="side-footer">
          <div className="side-user">
            <span className="avatar" aria-hidden>
              {initial}
            </span>
            <div>
              <div className="side-user-name">{userName}</div>
              <div className="side-user-role">{roleLabel}</div>
            </div>
          </div>
          <Link href="/account" className={isAccount ? 'side-item active' : 'side-item'}>
            <ShieldCheck size={18} />
            Keamanan Akun
          </Link>
          <button type="button" className="side-item" onClick={logout} disabled={loggingOut}>
            {loggingOut ? <LoaderCircle size={18} className="spin" /> : <LogOut size={18} />}
            Keluar
          </button>
        </div>
      </aside>

      <div>
        {/* ---- Top bar kaca (mobile) ---- */}
        <header className="topbar-glass">
          <div className="topbar-slot">
            {!isHome && (
              <Link href="/" className="back-btn">
                <ChevronLeft size={22} />
                Beranda
              </Link>
            )}
          </div>
          <div className="topbar-title">{topTitle}</div>
          <div className="topbar-slot end">
            <span className="avatar" title={`${userName} — ${roleLabel}`}>
              {initial}
            </span>
          </div>
        </header>

        <main className="content">{children}</main>

        {/* ---- Dock kaca (mobile) ---- */}
        <nav className="dock" aria-label="Navigasi bawah">
          <Link href="/" className={isHome ? 'dock-item active' : 'dock-item'}>
            <House size={20} />
            Beranda
          </Link>
          {isOwner && (
            <Link href="/admin/users" className={isAdmin ? 'dock-item active' : 'dock-item'}>
              <Users size={20} />
              Admin
            </Link>
          )}
          <Link href="/account" className={isAccount ? 'dock-item active' : 'dock-item'}>
            <ShieldCheck size={20} />
            Akun
          </Link>
          <button type="button" className="dock-item" onClick={logout} disabled={loggingOut}>
            {loggingOut ? <LoaderCircle size={20} className="spin" /> : <LogOut size={20} />}
            Keluar
          </button>
        </nav>
      </div>
    </div>
  );
}
