import '@/styles/globals.css';
import '@/styles/theme-ops.css';
import '@/styles/theme-dashboard.css';
import '@/styles/dashboard-font.css';
import '@/styles/theme-inventory.css';
import '@/styles/sky-toggle.css';
import '@/styles/glass-calendar.css';
import '@/styles/origin-ui.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import Providers from '@/components/Providers';

/**
 * Inter self-hosted lewat next/font — menggantikan <link> Google Fonts di
 * index.html Dashboard lama. Bobot mengikuti sumber (400/500/600/700).
 * Dipakai sisi dashboard via --font (lihat styles/dashboard-font.css); sisi ops
 * tetap memakai font sistem seperti sebelumnya.
 */
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter'
});


export const metadata: Metadata = {
  title: 'Kost Tiga Dara',
  description: 'Dashboard manajemen & operasional harian Kost Tiga Dara Putri UGM',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Kost TD' }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f2f0' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1614' }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="id" className={`${inter.variable}`} suppressHydrationWarning>
        <body>
          <Script id="ktd-theme-init" strategy="beforeInteractive">
            {`try{var t=localStorage.getItem('ktd-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`}
          </Script>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
