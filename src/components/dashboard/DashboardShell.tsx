'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';
import { ROLE_NAV } from '@/config/dashboard-nav';
import type { DashboardRole } from '@/config/dashboard-access';
import { initials } from '@/lib/dashboard/format';
import ThemeToggle from '@/components/ui/ThemeToggle';
import ChartTooltip from '@/components/charts/ChartTooltip';
import PeriodFilter from './PeriodFilter';
import {
  IconHome,
  IconSearch,
  IconRefresh,
  IconBell,
  IconSidebar,
  IconExpand,
  IconMenu,
  IconCaret,
  IconLock,
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
   - Tombol notifikasi & layar penuh DIBIARKAN dekoratif seperti di sumber —
     di app.js keduanya juga tidak punya handler. Tidak "diperbaiki" (§11.2.1).
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
  isDash,
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
          </div>
        )}

        <div className="side-user">
          <span className="avatar">{initials(userName || r.label)}</span>
          <div className="side-user__meta">
            <b>{userName || r.label}</b>
            <small>
              Masuk sebagai {role}
              {tfaEnabled ? ' · 2FA' : ''}
            </small>
          </div>
          <Link href="/dashboard/akun" className="side-logout" id="securityBtn" aria-label="Akun & Keamanan" title="Akun & Keamanan">
            <IconLock />
          </Link>
          <SignOutButton redirectUrl="/login">
            <button className="side-logout" id="logoutBtn" aria-label="Keluar" title="Keluar">
              <IconLogout />
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/*
        BUG DITEMUKAN & DIPERBAIKI (lihat docs/PENYIMPANGAN.md G10): wrapper
        `.main` ini sempat hilang dari port awal. Tanpa dia, `.topbar` &
        `.content` jadi grid-item LANGSUNG milik `.app` (bukan anak `.main`),
        dan grid 2-kolom `.app` (lihat theme-dashboard.css) menaruhnya lewat
        auto-placement row-major: topbar di row1-col2, content di
        row2-COL1 — persis di bawah sidebar, nyempil ke lebar kolom sidebar.
        Verbatim struktur `render()` app.js: sidebar, lalu `.main` (berisi
        topbar+content), lalu scrim — tiga anak `.app`, bukan empat/lima.
      */}
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
            <label className="search">
              <span>
                <IconSearch />
              </span>
              <input type="text" id="globalSearch" placeholder="Search" />
              <kbd>⌘ /</kbd>
            </label>
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
            <button className="topbar__icon topbar__bell" aria-label="Notifikasi" title="Notifikasi">
              <IconBell />
            </button>
            <button className="topbar__icon" id="fullscreenBtn" aria-label="Layar penuh" title="Layar penuh">
              <IconExpand />
            </button>
          </div>
        </header>

        <main className="content">
          {isDash && (
            <div className="page-head">
              <div className="seg">
                <button className="is-active">Overview</button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* scrim drawer mobile — verbatim dari app.js */}
      <div id="scrim" className="scrim" onClick={() => setNavOpen(false)} />

      <ChartTooltip />
    </div>
  );
}
