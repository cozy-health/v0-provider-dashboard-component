import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { sealAdmin, openAdmin, adminRoute, validAdminOrigin, adminBase } from '../lib/admin-session.ts'
import { sealSession } from '../lib/provider-session.ts'
const require = createRequire(import.meta.url)
process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex')
process.env.PROVIDER_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET
process.env.ADMIN_DASHBOARD_ORIGIN = 'https://admin.example.test'
test('admin cookie encryption is isolated from provider even if keys coincide', () => {
  const session = { token: 'secret-admin-token', expires: Date.now() + 60000 }
  const value = sealAdmin(session)
  assert.deepEqual(openAdmin(value), session)
  assert.equal(openAdmin(sealSession(session)), null)
  const bytes = Buffer.from(value, 'base64url'); bytes[30] ^= 1
  assert.equal(openAdmin(bytes.toString('base64url')), null)
  assert.equal(openAdmin(sealAdmin({ ...session, expires: 0 })), null)
})
test('admin routes exclude all individual-data and write endpoints', () => {
  assert.ok(adminRoute('metrics/overview', 'GET'))
  for (const path of ['clients', 'me', 'settings', 'metrics/analytics', '../provider/clients']) assert.equal(adminRoute(path, 'GET'), false)
  assert.equal(adminRoute('metrics/safety', 'POST'), false)
  assert.equal(adminRoute('auth/register', 'POST'), false)
})
test('admin CSRF requires exact origin and explicit header', () => {
  const request = headers => new Request('https://admin.example.test/api/admin/auth/login', { method: 'POST', headers })
  assert.ok(validAdminOrigin(request({ origin: 'https://admin.example.test', 'x-cozy-request': '1' })))
  assert.equal(validAdminOrigin(request({ origin: 'https://evil.test', 'x-cozy-request': '1' })), false)
  assert.equal(validAdminOrigin(request({ origin: 'https://admin.example.test' })), false)
})
test('admin API config rejects unexpected prefix and production HTTP', () => {
  const original = process.env.NODE_ENV
  process.env.ADMIN_API_URL = 'http://localhost/api/v1/admin/'; process.env.NODE_ENV = 'production'
  assert.throws(adminBase)
  process.env.ADMIN_API_URL = 'https://backend.example.test/api/v1/provider/'
  assert.throws(adminBase)
  process.env.ADMIN_API_URL = 'https://backend.example.test/api/v1/admin/'
  assert.equal(adminBase().pathname, '/api/v1/admin/')
  process.env.NODE_ENV = original || 'test'; delete process.env.ADMIN_API_URL
})
test('rendered suppression and immature cells never disclose hidden counts or rates', () => {
  const ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const source = readFileSync(new URL('../components/admin/metric-display.tsx', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText
  const loaded = { exports: {} }; new Function('require', 'module', 'exports', compiled)(require, loaded, loaded.exports)
  const hidden = renderToStaticMarkup(React.createElement(loaded.exports.RetentionCell, { cell: { status: 'suppressed', count: 123, cohort: 987, rate: 42 } }))
  assert.match(hidden, /&lt;5/); for (const value of ['123', '987', '42%']) assert.ok(!hidden.includes(value))
  const immature = renderToStaticMarkup(React.createElement(loaded.exports.RetentionCell, { cell: { status: 'immature', count: null, cohort: null, rate: null } }))
  assert.match(immature, /Not mature/)
})
