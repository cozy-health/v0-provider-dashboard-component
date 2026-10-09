import test from 'node:test'
import assert from 'node:assert/strict'
import { contentSecurityPolicy, securityHeaders } from '../lib/security-headers.mjs'

test('production CSP permits nonce scripts without unsafe script bypasses', () => {
  const csp = contentSecurityPolicy('verifiedNonce123==')
  assert.ok(csp.includes("default-src 'self'"))
  const scripts = csp.split(';').find(v => v.trim().startsWith('script-src'))
  assert.ok(scripts.includes("'nonce-verifiedNonce123=='"))
  assert.ok(!scripts.includes('unsafe-inline'))
  assert.ok(!scripts.includes('unsafe-eval'))
  assert.throws(() => contentSecurityPolicy("'><script>"))
})
test('global headers include all required browser security controls', () => {
  const headers = Object.fromEntries(securityHeaders.map(h => [h.key,h.value]))
  assert.equal(headers['X-Frame-Options'],'DENY')
  assert.equal(headers['X-Content-Type-Options'],'nosniff')
  assert.equal(headers['Permissions-Policy'],'geolocation=(), microphone=(), camera=()')
  assert.equal(headers['Strict-Transport-Security'],'max-age=31536000; includeSubDomains')
})
