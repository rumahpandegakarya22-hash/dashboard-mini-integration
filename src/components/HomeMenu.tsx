'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { DIVISION_GROUPS, NAV_TEMAN_RARA, NAV_PENGATURAN, NAV_PENGHUNI, NAV_RIWAYAT_BAYAR, NAV_LAPORAN_KEUANGAN, NAV_LANDING_PAGE, NAV_CHECKIN, NAV_CHECKOUT, moduleIcon } from './module-icons';
import type { NavModule } from './AppShell';

interface Props {
  isOwner: boolean;
  canKelola: boolean;
  canLandingPage?: boolean;
  canRiwayatBayar?: boolean;
  canInspeksi?: boolean;
  modules: NavModule[];
}

const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export default function HomeMenu({ isOwner, canKelola, canLandingPage, canRiwayatBayar, canInspeksi, modules }: Props) {
  const groups = DIVISION_GROUPS.map((g) => ({
    label: g.label,
    items: g.ids.map((id) => modules.find((m) => m.id === id)).filter((m): m is NavModule => !!m)
  })).filter((g) => g.items.length > 0);
  const showLabels = groups.length > 1;

  let cardIndex = 0;

  function ModuleCard({ id, title, href, icon: Icon }: NavModule & { href: string; icon: ReturnType<typeof moduleIcon> }) {
    const i = cardIndex++;
    return (
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
        whileTap={{ scale: 0.97 }}
      >
        <Link href={href} className="module-card border-beam">
          <span className="icon-tile" aria-hidden>
            <Icon size={20} />
          </span>
          <span className="module-card-title">{title}</span>
        </Link>
      </motion.div>
    );
  }

  return (
    <>
      {modules.length === 0 && !isOwner && (
        <div className="card">
          <p className="muted">Tidak ada modul untuk role ini. Hubungi Owner jika ini tidak sesuai.</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          {showLabels && <h2 className="section-title">{g.label}</h2>}
          <div className="module-grid">
            {g.items.map((m) => (
              <ModuleCard key={m.id} id={m.id} title={m.title} href={`/ops/m/${m.id}`} icon={moduleIcon(m.id)} />
            ))}
          </div>
          {g.label === 'Administrasi' && canKelola && (
            <div className="module-grid" style={{ marginTop: 8 }}>
              <ModuleCard id="penghuni" title={NAV_PENGHUNI.label} href={NAV_PENGHUNI.href} icon={NAV_PENGHUNI.icon} />
            </div>
          )}
        </section>
      ))}

      {canKelola && (
        <section aria-label="Teman Rara">
          <h2 className="section-title">Teman Rara</h2>
          <div className="module-grid">
            {NAV_TEMAN_RARA.map((n) => (
              <ModuleCard key={n.href} id={n.href} title={n.label} href={n.href} icon={n.icon} />
            ))}
            {canLandingPage && (
              <ModuleCard id="landing-page" title={NAV_LANDING_PAGE.label} href={NAV_LANDING_PAGE.href} icon={NAV_LANDING_PAGE.icon} />
            )}
          </div>
        </section>
      )}

      {!canKelola && canLandingPage && (
        <section aria-label="Marketing Admin">
          <h2 className="section-title">Marketing Admin</h2>
          <div className="module-grid">
            <ModuleCard id="landing-page" title={NAV_LANDING_PAGE.label} href={NAV_LANDING_PAGE.href} icon={NAV_LANDING_PAGE.icon} />
          </div>
        </section>
      )}

      {canKelola && (
        <section aria-label="Pengaturan">
          <h2 className="section-title">Pengaturan</h2>
          <div className="module-grid">
            {NAV_PENGATURAN.filter((n) => !n.ownerOnly || isOwner).map((n) => (
              <ModuleCard key={n.href} id={n.href} title={n.label} href={n.href} icon={n.icon} />
            ))}
          </div>
        </section>
      )}

      {canRiwayatBayar && (
        <section aria-label="Laporan">
          <h2 className="section-title">Laporan</h2>
          <div className="module-grid">
            <ModuleCard id="riwayat-pembayaran" title={NAV_RIWAYAT_BAYAR.label} href={NAV_RIWAYAT_BAYAR.href} icon={NAV_RIWAYAT_BAYAR.icon} />
            <ModuleCard id="laporan-keuangan" title={NAV_LAPORAN_KEUANGAN.label} href={NAV_LAPORAN_KEUANGAN.href} icon={NAV_LAPORAN_KEUANGAN.icon} />
          </div>
        </section>
      )}

      {canInspeksi && (
        <section aria-label="Check-in">
          <h2 className="section-title">Check-in</h2>
          <div className="module-grid">
            {NAV_CHECKIN.filter((n) => !n.adminOnly || canKelola).map((n) => (
              <ModuleCard key={n.href} id={n.href} title={n.label} href={n.href} icon={n.icon} />
            ))}
          </div>
        </section>
      )}

      {canInspeksi && (
        <section aria-label="Check-out">
          <h2 className="section-title">Check-out</h2>
          <div className="module-grid">
            {NAV_CHECKOUT.filter((n) => !n.adminOnly || canKelola).map((n) => (
              <ModuleCard key={n.href} id={n.href} title={n.label} href={n.href} icon={n.icon} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
