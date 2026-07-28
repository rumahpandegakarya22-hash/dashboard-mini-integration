'use client';

// Chrome adaptif "Liquid Glass":
//  - < 900px : top bar kaca mengambang + dock kaca di bawah (operasi satu jempol)
//  - ≥ 900px : sidebar kaca dengan navigasi modul per divisi
// Konten selalu di permukaan solid — kaca hanya untuk chrome ini.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { ChevronLeft, House, LoaderCircle, LogOut, Menu, ShieldCheck, Users, LayoutDashboard, Package } from 'lucide-react';
import { DIVISION_GROUPS, NAV_TEMAN_RARA, moduleIcon } from './module-icons';

/** Item sidebar dengan pil aktif yang meluncur (layoutId bersama) — pola
 * manuarora700: satu elemen `motion` dipindah antar item lewat shared layout
 * animation, bukan style statis yang loncat. */
function SideLink({
  href,
  active,
  icon: Icon,
  children
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={active ? 'side-item active' : 'side-item'} style={{ position: 'relative' }}>
      {active && (
        <motion.span
          layoutId="ops-side-active"
          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'var(--r-md)',
            background: 'var(--brand-tint)'
          }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>
        <Icon size={18} />
      </span>
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
    </Link>
  );
}

export interface NavModule {
  id: string;
  title: string;
}

interface Props {
  userName: string;
  roleLabel: string;
  isOwner: boolean;
  /** Owner atau Staff Admin — pemegang tugas pengelola sisi penghuni. */
  canKelola?: boolean;
  /** true bila akun ini juga punya akses Dashboard — menampilkan tautan silang (§9 Fase 5.2). */
  hasDashboardAccess?: boolean;
  modules: NavModule[];
  children: React.ReactNode;
}

export default function AppShell({ userName, roleLabel, isOwner, canKelola,
  hasDashboardAccess, modules, children }: Props) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const [loggingOut, setLoggingOut] = useState(false);
  // Drawer sidebar mobile (<900px) — tak ada jalan buka menu penuh sebelum
  // ini (UAT #6); tutup otomatis tiap ganti route, sama pola dgn Dashboard.
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);

  const isHome = pathname === '/ops';
  // Khusus halaman kelola user. Dipersempit dari '/ops/admin' sejak ada halaman
  // admin lain di bawah prefix yang sama — kalau tidak, semuanya ikut tersorot.
  const isAdmin = pathname.startsWith('/ops/admin/users');
  const isAccount = pathname.startsWith('/ops/account');
  const activeModule = modules.find((m) => pathname === `/ops/m/${m.id}`);
  const activeKelola = NAV_TEMAN_RARA.find((n) => pathname.startsWith(n.href));
  const topTitle = isHome
    ? 'Kost Tiga Dara'
    : activeKelola
      ? activeKelola.label
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
    <div className={navOpen ? 'shell nav-open' : 'shell'}>
      {/* ---- Sidebar: kolom statis di desktop, drawer off-canvas di mobile ---- */}
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
          <SideLink href="/ops" active={isHome} icon={House}>
            Beranda
          </SideLink>

          {groups.map((g) => (
            <div key={g.label}>
              {groups.length > 1 && <div className="side-group-label">{g.label}</div>}
              {g.items.map((m) => {
                const Icon = moduleIcon(m.id);
                const active = pathname === `/ops/m/${m.id}`;
                return (
                  <SideLink key={m.id} href={`/ops/m/${m.id}`} active={active} icon={Icon}>
                    {m.title}
                  </SideLink>
                );
              })}
            </div>
          ))}

          {isOwner && (
            <div>
              <div className="side-group-label">Admin</div>
              {/* Satu pintu kelola akun: panel gabungan di Dashboard mengatur
                  role Ops DAN Dashboard sekaligus. Panel lokal Ops hanya jadi
                  cadangan untuk Owner yang belum punya akses Dashboard. */}
              {hasDashboardAccess ? (
                <a href="/dashboard/akun" className="side-item">
                  <Users size={18} />
                  Kelola User
                </a>
              ) : (
                <SideLink href="/ops/admin/users" active={isAdmin} icon={Users}>
                  Kelola User
                </SideLink>
              )}
            </div>
          )}

          {canKelola && (
            <div>
              <div className="side-group-label">Teman Rara</div>
              {NAV_TEMAN_RARA.map((n) => {
                const Icon = n.icon;
                return (
                  <SideLink key={n.href} href={n.href} active={pathname.startsWith(n.href)} icon={Icon}>
                    {n.label}
                  </SideLink>
                );
              })}
            </div>
          )}

          {/* Navigasi silang (§9 Fase 5.2) — hanya bila akun ini punya akses
              Dashboard, supaya tidak menawarkan pintu yang terkunci. */}
          <div>
            <div className="side-group-label">Aplikasi Lain</div>
            {hasDashboardAccess && (
              <a href="/dashboard" className="side-item">
                <LayoutDashboard size={18} />
                Dashboard
              </a>
            )}
            {/* Inventory dibuka dengan akses Ops yang sama, jadi tautannya
                selalu ada — beda dari Dashboard yang butuh akses terpisah. */}
            <a href="/inventory" className="side-item">
              <Package size={18} />
              Inventory Stock
            </a>
          </div>
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
          <SideLink href="/ops/account" active={isAccount} icon={ShieldCheck}>
            Keamanan Akun
          </SideLink>
          <button type="button" className="side-item" onClick={logout} disabled={loggingOut}>
            {loggingOut ? <LoaderCircle size={18} className="spin" /> : <LogOut size={18} />}
            Keluar
          </button>
        </div>
      </aside>

      {/* Backdrop drawer mobile — klik utk tutup, sama pola dgn scrim Dashboard. */}
      <div className="ops-scrim" onClick={() => setNavOpen(false)} />

      <div>
        {/* ---- Top bar kaca (mobile) ---- */}
        <header className="topbar-glass">
          <div className="topbar-slot">
            {!isHome && (
              <Link href="/ops" className="back-btn">
                <ChevronLeft size={22} />
                Beranda
              </Link>
            )}
          </div>
          <div className="topbar-title">{topTitle}</div>
          <div className="topbar-slot end">
            <button
              type="button"
              className="topbar-menu-btn"
              aria-label="Buka menu"
              onClick={() => setNavOpen((o) => !o)}
            >
              <Menu size={20} />
            </button>
            <span className="avatar" title={`${userName} — ${roleLabel}`}>
              {initial}
            </span>
          </div>
        </header>

        {/* Semua halaman mengalir mengikuti lebar layar. Kolom nyaman-baca
            640px tidak lagi dipasang di sini melainkan per-blok lewat
            `.form-col`, karena yang butuh dibatasi hanya form — daftar data
            justru rugi kalau dikurung (satu kolom kurus + lorong kosong di
            kanan). Satu-satunya pengecualian: halaman tanpa daftar apa pun,
            di mana pembatas kolomnya sudah melekat di isinya sendiri. */}
        <main className="content content--wide">{children}</main>

        {/* ---- Dock kaca (mobile) ---- */}
        <nav className="dock" aria-label="Navigasi bawah">
          <Link href="/ops" className={isHome ? 'dock-item active' : 'dock-item'}>
            <House size={20} />
            Beranda
          </Link>
          {isOwner && (
            <Link href="/ops/admin/users" className={isAdmin ? 'dock-item active' : 'dock-item'}>
              <Users size={20} />
              Admin
            </Link>
          )}
          <Link href="/ops/account" className={isAccount ? 'dock-item active' : 'dock-item'}>
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
