import { securityHeaders } from './lib/security-headers.mjs'
/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
