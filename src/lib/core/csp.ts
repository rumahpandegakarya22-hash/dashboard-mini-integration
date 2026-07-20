/* =========================================================================
   Content-Security-Policy — sumber tunggal, dipakai proxy.ts per request.

   KENAPA DI SINI, BUKAN DI next.config.mjs:
   Next menyuntik inline <script> untuk hydration (`self.__next_f.push(…)`).
   CSP statis di `headers()` tidak bisa memberi nonce, sehingga script itu
   diblokir `script-src-elem` → React tidak pernah hydrate → HALAMAN BLANK.
   Itu persis yang terjadi saat CSP pertama kali dipasang (lihat MIGRASI §5.3).

   Jalan keluarnya nonce per-request: middleware membuat nonce, menaruhnya di
   header REQUEST supaya Next menandai script-nya, dan di header RESPONSE supaya
   browser menerimanya. Dengan begitu `'unsafe-inline'` TIDAK diperlukan di
   produksi — CSP tetap ketat.

   `style-src 'unsafe-inline'` tetap ada: React menyuntik atribut `style` inline
   (stat-card, chart) yang tidak bisa diberi nonce. Sama seperti CSP lama.
   ========================================================================= */

/** Origin Clerk. Bila CLERK_FRONTEND_API_ORIGIN di-set, dipakai spesifik. */
function clerkHosts(): string[] {
  const o = process.env.CLERK_FRONTEND_API_ORIGIN;
  return o ? [o] : ['https://*.clerk.accounts.dev', 'https://*.clerk.com'];
}

export function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const clerk = clerkHosts().join(' ');

  // Dev: Next HMR memakai eval + inline yang tidak ber-nonce, jadi 'unsafe-eval'
  // & 'unsafe-inline' terpaksa diizinkan DI DEV SAJA. Produksi murni nonce.
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval' ${clerk} https://challenges.cloudflare.com`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' ${clerk} https://challenges.cloudflare.com`;

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self'`,
    `img-src 'self' data: blob: https://img.clerk.com`,
    `connect-src 'self' ${clerk}`,
    `worker-src 'self' blob:`,
    `frame-src https://challenges.cloudflare.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`
  ].join('; ');
}

/** Header keamanan non-CSP — nilainya sama dgn vercel.json Dashboard lama. */
export const SECURITY_HEADERS: [string, string][] = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'geolocation=(), microphone=(), camera=()']
];
