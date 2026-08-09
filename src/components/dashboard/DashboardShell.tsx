'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { SignOutButton } from '@clerk/nextjs';
import { ROLE_NAV } from '@/config/dashboard-nav';
import type { DashboardRole } from '@/config/dashboard-access';
import { initials } from '@/lib/dashboard/format';
import ThemeToggle from '@/components/ui/ThemeToggle';
import ChartTooltip from '@/components/charts/ChartTooltip';
import PeriodFilter from './PeriodFilter';
import {
  IconHome,
  IconRefresh,
  IconSidebar,
  IconMenu,
  IconCaret,
  IconGear,
  IconLogout
} from './icons';

/* PORT dari `buildSidebar()` + `buildTopbar()` + `pageHead()` public/app.js
   (Fase 4 langkah 3). Struktur markup & seluruh nama kelas dipertahankan
   (.app, .sidebar, .brand, .side-section, .nav-link, .side-user, .topbar,
   .crumbs, .content, .page-head) agar CSS hasil port berlaku apa adanya.

   Perbedaan yang disengaja:
   - Navigasi memakai <Link> App Router, bukan <a href="#"> + state `cur.page`;
     halaman kini punya URL sendiri sehingga bisa di-bookmark & di-back (§2.3).
   - Toggle tema dipisah ke komponen ThemeToggle bersama (dipakai ops juga).
   - Tombol notifikasi & layar penuh DIHAPUS (UAT #3). Keduanya memang tidak
     pernah punya handler, baik di app.js maupun di port ini.
   - `#refreshBtn` memuat ulang route (router.refresh lewat reload) — di sumber
     ia memanggil loadLiveData(); padanan terdekat di App Router. */

export interface DashboardShellProps {
  role: DashboardRole;
  userName: string;
  tfaEnabled?: boolean;
  /** id view aktif — untuk menandai nav-link & breadcrumb. */
  view: string;
  crumb: string;
  /** true bila akun ini juga punya akses Mini App Ops — menampilkan tautan silang. */
  hasOpsAccess?: boolean;
  /** true bila view ini bergrup "dash" (menampilkan page-head). */
  isDash?: boolean;
  period: string;
  from?: string;
  to?: string;
  children: React.ReactNode;
}

export default function DashboardShell({
  role,
  userName,
  tfaEnabled,
  view,
  crumb,
  hasOpsAccess,
  period,
  from,
  to,
  children
}: DashboardShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const r = ROLE_NAV[role];

  const href = (id: string) => (id === 'overview' ? '/dashboard' : `/dashboard/${id}`);

  const navItem = (p: { id: string; label: string; group: string }) => (
    <Link
      key={p.id}
      href={href(p.id)}
      className={`nav-link ${p.id === view ? 'is-active' : ''}`}
      data-page={p.id}
      onClick={() => setNavOpen(false)}
    >
      {p.group === 'dash' ? <span className="ico round" /> : <span className="caret"><IconCaret /></span>}
      {p.label}
    </Link>
  );

  const dashItems = r.pages.filter((p) => p.group === 'dash');
  const pageItems = r.pages.filter((p) => p.group === 'page');

  return (
    <div className={`app${navOpen ? ' nav-open' : ''}${sidebarHidden ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__logo">
            <IconHome />
          </span>
          <span className="brand__name">{r.sidebarName}</span>
        </div>

        <PeriodFilter period={period} from={from} to={to} />

        <div className="side-section">
          <div className="side-section__title">Dashboards</div>
          {dashItems.map(navItem)}
        </div>
        <div className="side-section">
          <div className="side-section__title">Pages</div>
          {pageItems.map(navItem)}
        </div>

        {/* Navigasi silang (§9 Fase 5.2) — hanya muncul bila akun ini memang
            punya akses sisi lain, supaya tidak menawarkan pintu yang terkunci. */}
        {hasOpsAccess && (
          <div className="side-section">
            <div className="side-section__title">Aplikasi Lain</div>
            <a className="nav-link" href="/ops">
              <span className="caret">
                <IconCaret />
              </span>
              Mini App Ops
            </a>
            {/* Inventory Stock: hanya untuk role yang memang mengelola stok */}
            {role !== 'marketing' && role !== 'sales' && (
              <a className="nav-link" href="/inventory">
                <span className="caret">
                  <IconCaret />
                </span>
                Inventory Stock
              </a>
            )}
          </div>
        )}

        <div className="side-user">
          <span className="avatar">{initials(userName || r.label)}</span>
          <div className="side-user__meta">
            <b>{userName || r.label}</b>
            <small>
               {role}
              {tfaEnabled ? ' · 2FA' : ''}
            </small>
          </div>
          <Link href="/dashboard/akun" className="side-logout" id="securityBtn" aria-label="Akun & Keamanan" title="Akun & Keamanan">
            <IconGear />
          </Link>
          <SignOutButton redirectUrl="/login">
            <button className="side-logout" id="logoutBtn" aria-label="Keluar" title="Keluar">
              <IconLogout />
            </button>
          </SignOutButton>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="topbar__icon menu-toggle" id="menuToggle" aria-label="Menu" onClick={() => setNavOpen((o) => !o)}>
            <IconMenu />
          </button>
          <button
            className="topbar__icon"
            id="sidebarToggle"
            aria-label="Sembunyikan sidebar"
            title="Sembunyikan/Tampilkan sidebar"
            onClick={() => setSidebarHidden((h) => !h)}
          >
            <IconSidebar />
          </button>

          <nav className="crumbs">
            <span>Dashboards</span>
            <span className="sep">/</span>
            <span className="cur">{crumb}</span>
          </nav>

          <div className="topbar__right">
            <ThemeToggle />
            <button
              className="topbar__icon"
              id="refreshBtn"
              aria-label="Refresh"
              title="Muat ulang data"
              onClick={() => window.location.reload()}
            >
              <IconRefresh />
            </button>
          </div>
        </header>

        <main className="content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${view}::${period}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* scrim drawer mobile — verbatim dari app.js */}
      <div id="scrim" className="scrim" onClick={() => setNavOpen(false)} />

      <ChartTooltip />
    </div>
  );
}
