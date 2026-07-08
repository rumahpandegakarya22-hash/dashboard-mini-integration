/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '12mb' } // upload bukti/nota maks 10 MB
  }
};
export default nextConfig;
