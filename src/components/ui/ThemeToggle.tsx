'use client';

import { useEffect, useState } from 'react';

/* PORT dari toggle tema `#themeToggle` public/app.js (Fase 4), disatukan ke
   mekanisme `data-theme` milik Mini App sesuai §4.3.

   Pemetaan yang dipakai (dan alasannya):
     - Key localStorage `ktd-theme` DIPERTAHANKAN, sehingga preferensi tema
       pengguna dashboard yang sudah ada ikut terbawa setelah cutover.
     - Nilai 'light' memasang atribut `data-theme="light"` di <html>; nilai
       'dark' memasangnya sebagai "dark".
     - Dashboard: tanpa atribut = gelap (token dasarnya gelap, hanya
       :root[data-theme='light'] yang menimpa) — sama dengan default lama.
     - Ops: tanpa atribut = ikut prefers-color-scheme, persis seperti sebelumnya.

   Skrip anti-kedip ada di app/layout.tsx; komponen ini hanya menangani interaksi. */

export const THEME_KEY = 'ktd-theme';
export type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return 'dark';
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export default function ThemeToggle({ className = 'topbar__icon' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* mode privat / storage diblokir — tema tetap berlaku untuk sesi ini */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      id="themeToggle"
      className={className}
      onClick={toggle}
      aria-label={theme === 'light' ? 'Ganti ke tema gelap' : 'Ganti ke tema terang'}
      title={theme === 'light' ? 'Tema gelap' : 'Tema terang'}
    >
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
