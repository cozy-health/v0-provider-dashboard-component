export function contentSecurityPolicy(nonce, development = false) {
  if (!/^[a-zA-Z0-9+/=]+$/.test(nonce)) throw new Error('Invalid nonce')
  return `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self' https://vitals.vercel-insights.com${development ? ' ws: http://localhost:*' : ''}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
}
export const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: "default-src 'self'" },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
]
