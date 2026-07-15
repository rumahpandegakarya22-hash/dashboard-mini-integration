'use client';

import { useEffect, useState } from 'react';

/** Header sapaan beranda — dipisah dari HomeMenu supaya Joblist bisa tampil di paling atas (Improvement v1.1 §3). */
export default function HomeGreeting({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  // Sapaan mengikuti jam perangkat user — dihitung setelah mount agar SSR (jam server) tidak bentrok.
  const [greeting, setGreeting] = useState('Halo');
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 10 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam');
  }, []);

  return (
    <header className="page-head">
      <div>
        <h1>
          {greeting}, {userName}
        </h1>
        <p className="page-head-sub">{roleLabel} · pilih modul untuk mulai input</p>
      </div>
    </header>
  );
}
