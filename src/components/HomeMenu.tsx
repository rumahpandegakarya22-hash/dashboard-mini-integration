'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { DIVISION_GROUPS, moduleIcon } from './module-icons';
import type { NavModule } from './AppShell';

interface Props {
  userName: string;
  roleLabel: string;
  isOwner: boolean;
  modules: NavModule[];
}

const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export default function HomeMenu({ userName, roleLabel, isOwner, modules }: Props) {
  // Sapaan mengikuti jam perangkat user — dihitung setelah mount agar SSR (jam server) tidak bentrok.
  const [greeting, setGreeting] = useState('Halo');
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 10 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam');
  }, []);

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
        <Link href={href} className="module-card">
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
      <header className="page-head">
        <div>
          <h1>
            {greeting}, {userName}
          </h1>
          <p className="page-head-sub">
            {roleLabel} · pilih modul untuk mulai input
          </p>
        </div>
      </header>

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
              <ModuleCard key={m.id} id={m.id} title={m.title} href={`/m/${m.id}`} icon={moduleIcon(m.id)} />
            ))}
          </div>
        </section>
      ))}

      {isOwner && (
        <section aria-label="Admin">
          <h2 className="section-title">Admin</h2>
          <div className="module-grid">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.3, ease: EASE }}
              whileTap={{ scale: 0.97 }}
            >
              <Link href="/admin/users" className="module-card">
                <span className="icon-tile" aria-hidden>
                  <Users size={20} />
                </span>
                <span className="module-card-title">Kelola User</span>
              </Link>
            </motion.div>
          </div>
        </section>
      )}
    </>
  );
}
