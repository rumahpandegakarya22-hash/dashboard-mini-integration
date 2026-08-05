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
   * File font invoice dibaca lewat fs saat render PDF. Next tidak bisa
   * mendeteksi pembacaan itu secara statis, jadi tanpa baris ini font-nya tidak
   * ikut terbawa ke bundle serverless dan PDF di produksi jatuh ke font bawaan.
   */
  outputFileTracingIncludes: {
    '/**': ['./src/lib/invoice/fonts/**']
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
