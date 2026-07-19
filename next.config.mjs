/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '12mb' } // upload bukti/nota maks 10 MB
  },

  /**
   * Kompatibilitas transisi (§5.3): Mini App pindah dari akar ke prefix /ops.
   * 308 Permanent Redirect mempertahankan method & body, jadi bookmark lama,
   * shortcut PWA yang sudah terpasang di HP staf, dan tautan yang beredar di
   * WhatsApp tetap hidup. `permanent: true` = 308 di Next.
   *
   * Catatan: akar '/' TIDAK ada di sini — ditangani src/app/page.tsx yang di
   * Fase 3 berubah jadi dispatch sesuai akses (dashboard vs ops).
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
