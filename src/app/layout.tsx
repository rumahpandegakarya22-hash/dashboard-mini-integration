import '@/styles/globals.css';
import '@/styles/theme-ops.css';
import '@/styles/theme-dashboard.css';
import '@/styles/dashboard-font.css';
import '@/styles/theme-inventory.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
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

/** Font khas app Inventory Stock — self-hosted, menggantikan <link> Google Fonts
 *  di globals.css app lama. Hanya dipakai di subtree [data-app="inventory"]. */
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-outfit'
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
      {/*
        suppressHydrationWarning WAJIB di <html>: skrip anti-kedip di bawah
        memasang data-theme SEBELUM React hydrate, sehingga atribut di HTML hasil
        server (tanpa data-theme) sengaja berbeda dari DOM klien. Tanpa ini,
        setiap pengguna yang punya preferensi tema tersimpan akan memicu
        "hydration mismatch" di konsol. Cakupannya hanya atribut elemen ini.
      */}
      <html lang="id" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
        <body>
          {/*
            Anti-kedip tema: pasang data-theme SEBELUM konten ter-paint, jadi
            pengguna tidak melihat kilatan tema salah. Key `ktd-theme`
            dipertahankan dari Dashboard lama agar preferensi terbawa (§4.3).
            Tanpa nilai tersimpan: atribut tidak dipasang — dashboard tetap
            gelap (default token-nya) dan ops tetap mengikuti prefers-color-scheme.

            Dipasang lewat next/script `beforeInteractive` (bukan <script> mentah
            di dalam JSX) karena React memperingatkan tag script di dalam komponen
            — peringatan itu mengotori konsol, padahal gerbang §9 Fase 4 menuntut
            konsol bersih.
          */}
          <Script id="ktd-theme-init" strategy="beforeInteractive">
            {`try{var t=localStorage.getItem('ktd-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`}
          </Script>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
