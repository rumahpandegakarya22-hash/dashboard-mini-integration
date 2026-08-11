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
import { ChevronLeft, House, LoaderCircle, LogOut, Menu, Settings, ShieldCheck, Users, LayoutDashboard, Package } from 'lucide-react';
import { DIVISION_GROUPS, NAV_TEMAN_RARA, NAV_LANDING_PAGE, NAV_RIWAYAT_BAYAR, NAV_PENGATURAN, NAV_PENGHUNI, NAV_CHECKIN, NAV_CHECKOUT, moduleIcon } from './module-icons';

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
  /** Marketing + Owner dapat mengelola konten landing page. */
  canLandingPage?: boolean;
  /** Owner, Admin, Sales — melihat riwayat pembayaran per penghuni. */
  canRiwayatBayar?: boolean;
  /** Owner, Admin, Inspeksi — akses form Pre-Check In & Pre-Check Out. */
  canInspeksi?: boolean;
  modules: NavModule[];
  children: React.ReactNode;
}

export default function AppShell({ userName, roleLabel, isOwner, canKelola,
  hasDashboardAccess, canLandingPage, canRiwayatBayar, canInspeksi, modules, children }: Props) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const [loggingOut, setLoggingOut] = useState(false);
  // Drawer sidebar mobile (<900px) — tak ada jalan buka menu penuh sebelum
  // ini (UAT #6); tutup otomatis tiap ganti route, sama pola dgn Dashboard.
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);

  const isHome = pathname === '/ops';
  const isAccount = pathname.startsWith('/ops/account');
  const activeModule = modules.find((m) => pathname === `/ops/m/${m.id}`);
  // Cari judul halaman admin aktif dari semua nav admin
  const allAdminNav = [...NAV_TEMAN_RARA, ...NAV_PENGATURAN, NAV_PENGHUNI, NAV_LANDING_PAGE, NAV_RIWAYAT_BAYAR, ...NAV_CHECKIN, ...NAV_CHECKOUT];
  const activeAdminPage = allAdminNav.find((n) => pathname.startsWith(n.href));
  const topTitle = isHome
    ? 'Kost Tiga Dara'
    : activeAdminPage
      ? activeAdminPage.label
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

          {/* Ubah Data Penghuni di bawah grup Administrasi */}
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
              {/* Ubah Data Penghuni tampil setelah grup Administrasi */}
              {g.label === 'Administrasi' && canKelola && (
                <SideLink href={NAV_PENGHUNI.href} active={pathname.startsWith(NAV_PENGHUNI.href)} icon={NAV_PENGHUNI.icon}>
                  {NAV_PENGHUNI.label}
                </SideLink>
              )}
            </div>
          ))}

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
              <SideLink href={NAV_LANDING_PAGE.href} active={pathname.startsWith(NAV_LANDING_PAGE.href)} icon={NAV_LANDING_PAGE.icon}>
                {NAV_LANDING_PAGE.label}
              </SideLink>
            </div>
          )}

          {!canKelola && canLandingPage && (
            <div>
              <div className="side-group-label">Marketing Admin</div>
              <SideLink href={NAV_LANDING_PAGE.href} active={pathname.startsWith(NAV_LANDING_PAGE.href)} icon={NAV_LANDING_PAGE.icon}>
                {NAV_LANDING_PAGE.label}
              </SideLink>
            </div>
          )}

          {canRiwayatBayar && (
            <div>
              <div className="side-group-label">Laporan</div>
              <SideLink href={NAV_RIWAYAT_BAYAR.href} active={pathname.startsWith(NAV_RIWAYAT_BAYAR.href)} icon={NAV_RIWAYAT_BAYAR.icon}>
                {NAV_RIWAYAT_BAYAR.label}
              </SideLink>
            </div>
          )}

          {canInspeksi && (
            <div>
              <div className="side-group-label">Check-in</div>
              {NAV_CHECKIN.filter((n) => !n.adminOnly || canKelola).map((n) => (
                <SideLink key={n.href} href={n.href} active={pathname.startsWith(n.href)} icon={n.icon}>
                  {n.label}
                </SideLink>
              ))}
            </div>
          )}

          {canInspeksi && (
            <div>
              <div className="side-group-label">Check-out</div>
              {NAV_CHECKOUT.filter((n) => !n.adminOnly || canKelola).map((n) => (
                <SideLink key={n.href} href={n.href} active={pathname.startsWith(n.href)} icon={n.icon}>
                  {n.label}
                </SideLink>
              ))}
            </div>
          )}

          {/* BARU: grup Pengaturan */}
          {canKelola && (
            <div>
              <div className="side-group-label">Pengaturan</div>
              {NAV_PENGATURAN.filter((n) => !n.ownerOnly || isOwner).map((n) => (
                <SideLink key={n.href} href={n.href} active={pathname.startsWith(n.href)} icon={n.icon}>
                  {n.label}
                </SideLink>
              ))}
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

       
        <main className="content content--wide">{children}</main>

        {/* ---- Dock kaca (mobile) ---- */}
        <nav className="dock" aria-label="Navigasi bawah">
          <Link href="/ops" className={isHome ? 'dock-item active' : 'dock-item'}>
            <House size={20} />
            Beranda
          </Link>
          {canKelola && (
            <Link href="/ops/admin/deposit" className={pathname.startsWith('/ops/admin') ? 'dock-item active' : 'dock-item'}>
              <Settings size={20} />
              Pengaturan
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
