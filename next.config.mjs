/** @type {import('next').NextConfig} */

/**
 * CSP & header keamanan — PORT dari `vercel.json` repo Dashboard lama,
 * dipindah ke `headers()` Next (§9 Fase 5.3, mitigasi R7).
 *
 * Perubahan terhadap CSP lama, masing-masing dengan alasan:
 *
 *  DIHAPUS  https://cdn.jsdelivr.net dari script-src
 *           Dipakai app.js lama untuk memuat SDK Clerk & pustaka QR dari CDN.
 *           App terpadu memakai paket npm (@clerk/nextjs, qrcode) yang ikut
 *           di-bundle — tidak ada lagi skrip pihak ketiga yang dimuat runtime.
 *
 *  DIHAPUS  https://fonts.googleapis.com (style-src) & https://fonts.gstatic.com
 *           (font-src). Inter kini self-hosted lewat next/font, jadi kedua
 *           origin itu tidak pernah dihubungi lagi.
 *
 *  DITAMBAH 'unsafe-inline' pada script-src HANYA di mode dev.
 *           Next dev memakai eval/inline untuk HMR. Di produksi TIDAK dipakai.
 *
 *  DITAMBAH https://*.clerk.com pada script-src/connect-src/img-src.
 *           Instance produksi Clerk memakai domain clerk.com, bukan
 *           clerk.accounts.dev. Bila CLERK_FRONTEND_API_ORIGIN di-set, origin
 *           itu dipakai spesifik alih-alih wildcard — lebih sempit.
 *
 *  DITAMBAH blob: pada img-src — QR 2FA dirender sebagai data/blob URL.
 *
 *  TETAP    'unsafe-inline' pada style-src. React menyuntik style inline
 *           (mis. atribut style pada stat-card & chart) sehingga tidak bisa
 *           dihapus tanpa menulis ulang komponen. Sama seperti CSP lama.
 *
 * Catatan: `frame-ancestors 'none'` + `X-Frame-Options: DENY` dipertahankan —
 * app ini tidak pernah boleh di-iframe.
 */
const isDev = process.env.NODE_ENV !== 'production';

const clerkOrigin = process.env.CLERK_FRONTEND_API_ORIGIN;
// Bila origin produksi Clerk diketahui, pakai itu; kalau tidak, izinkan kedua
// pola domain Clerk (dev & produksi).
const clerkHosts = clerkOrigin
  ? [clerkOrigin]
  : ['https://*.clerk.accounts.dev', 'https://*.clerk.com'];

const csp = [
  `default-src 'self'`,
  `script-src 'self' ${isDev ? `'unsafe-inline' 'unsafe-eval' ` : ''}${clerkHosts.join(' ')} https://challenges.cloudflare.com`,
  `style-src 'self' 'unsafe-inline'`,
  `font-src 'self'`,
  `img-src 'self' data: blob: https://img.clerk.com`,
  `connect-src 'self' ${clerkHosts.join(' ')}`,
  `worker-src 'self' blob:`,
  `frame-src https://challenges.cloudflare.com`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`
].join('; ');

const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '12mb' } // upload bukti/nota maks 10 MB
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' }
        ]
      }
    ];
  },

  /**
   * Kompatibilitas transisi (§5.3): Mini App pindah dari akar ke prefix /ops.
   * 308 Permanent Redirect mempertahankan method & body, jadi bookmark lama,
   * shortcut PWA yang sudah terpasang di HP staf, dan tautan yang beredar di
   * WhatsApp tetap hidup. `permanent: true` = 308 di Next.
   *
   * Catatan: akar '/' TIDAK ada di sini — ditangani src/app/page.tsx yang
   * mendispatch sesuai akses (dashboard vs ops).
   */
  async redirects() {
    return [
      { source: '/m/:id', destination: '/ops/m/:id', permanent: true },
      { source: '/admin/users', destination: '/ops/admin/users', permanent: true },
      { source: '/account', destination: '/ops/account', permanent: true }
    ];
  }
};
export default nextConfig;
