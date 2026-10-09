import { securityHeaders } from './lib/security-headers.mjs'
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
