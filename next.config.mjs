/** @type {import('next').NextConfig} */

/**
 * CSP & header keamanan TIDAK di sini — dipasang `src/proxy.ts` per request
 * karena butuh nonce untuk inline script hydration Next. CSP statis di
 * `headers()` membuat script itu terblokir dan halaman blank di produksi.
 * Lihat `src/lib/core/csp.ts`.
 */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '12mb' } // upload bukti/nota maks 10 MB
  },

  /**
   * Dua hal yang dibaca lewat fs, bukan lewat import, sehingga file tracing Next
   * tidak melihatnya dan membuangnya dari bundle serverless:
   *
   *  - font invoice → tanpa ini PDF di produksi jatuh ke font bawaan
   *  - binary Chromium (.br/.tar di bin/) → tanpa ini muncul error
   *    'The input directory .../@sparticuz/chromium/bin does not exist'.
   *    serverExternalPackages di bawah saja TIDAK cukup: itu hanya mencegah
   *    paketnya di-bundle, tidak membuat isi bin/ ikut ter-deploy. Terbukti 8
   *    Agt 2026 — error yang sama masih muncul setelah fix pertama.
   */
  outputFileTracingIncludes: {
    '/**': ['./src/lib/invoice/fonts/**', './node_modules/@sparticuz/chromium/bin/**']
  },

  /**
   * @sparticuz/chromium membawa binary Chromium di folder bin/. Bundler Next
   * memindahkan file JS-nya sehingga path relatif ke bin/ ikut bergeser, dan di
   * Vercel muncul: 'The input directory "/var/task/node_modules/@sparticuz/
   * chromium/bin" does not exist'. Dua paket ini WAJIB dibiarkan sebagai
   * dependency eksternal (tidak di-bundle) agar path-nya tetap utuh.
   */
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],

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
