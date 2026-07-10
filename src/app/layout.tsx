import './globals.css';
import type { Metadata, Viewport } from 'next';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Mini App Kost Tiga Dara',
  description: 'Input operasional harian Kost Tiga Dara Putri UGM',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Kost TD' }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f5f3' },
    { media: '(prefers-color-scheme: dark)', color: '#171b19' }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
