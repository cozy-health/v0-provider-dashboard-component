import { securityHeaders } from './lib/security-headers.mjs'
const fixture = process.env.NODE_ENV === 'development' ? process.env.COZY_INTEGRATION_FIXTURE : undefined
if (fixture && !/^[a-z-]+$/.test(fixture)) throw new Error('Invalid integration fixture name')
/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(fixture ? {
    distDir: `.next-review-${fixture}`,
    typescript: { tsconfigPath: `scratch/tsconfig-${fixture}.json` },
  } : {}),
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
