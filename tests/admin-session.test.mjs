import { CSRF_COOKIE, csrfToken } from "../lib/csrf-server.mjs"
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
test('admin routes exclude unrelated APIs and unauthorized methods', () => {
  assert.ok(adminRoute('metrics/overview', 'GET'))
  for (const path of ['clients', 'me', 'settings', 'metrics/analytics', '../provider/clients']) assert.equal(adminRoute(path, 'GET'), false)
  assert.equal(adminRoute('metrics/safety', 'POST'), false)
  assert.equal(adminRoute('auth/register', 'POST'), false)
})
test('management routes permit only the implemented resource methods and identifiers', () => {
  for (const [path, method] of [['users', 'GET'], ['community/posts/12345678-1234-1234-1234-123456789abc', 'GET'], ['content/moods', 'POST'], ['content/coping/3', 'DELETE'], ['quizzes/8/publish', 'POST'], ['emails/welcome/preview', 'GET'], ['subscriptions/history', 'GET']]) assert.equal(adminRoute(path, method), true)
  for (const [path, method] of [['users', 'POST'], ['users/12', 'PUT'], ['users/12', 'DELETE'], ['community/posts/'+ '-'.repeat(36), 'GET'], ['content/unknown', 'GET'], ['content/moods/../users', 'PUT'], ['quizzes/1/publish', 'DELETE'], ['settings/test', 'PUT'], ['community/posts/not-a-uuid', 'PUT']]) assert.equal(adminRoute(path, method), false)
})
test('article publishing proxy permits only scoped resource operations', () => {
  const id = '12345678-1234-1234-1234-123456789abc'
  for (const method of ['GET', 'POST']) assert.equal(adminRoute('articles', method), true)
  for (const method of ['GET', 'PUT', 'DELETE']) assert.equal(adminRoute(`articles/${id}`, method), true)
  assert.equal(adminRoute(`articles/${id}/publish`, 'POST'), true)
  for (const [path, method] of [['articles/not-a-uuid', 'PUT'], [`articles/${id}/publish`, 'GET'], ['articles/../users', 'DELETE'], ['articles', 'DELETE']]) assert.equal(adminRoute(path, method), false)
})

test('development test access proxy permits only grant history, grant and UUID revocation', () => {
  for (const method of ['GET', 'POST']) assert.equal(adminRoute('development-access', method), true)
  assert.equal(adminRoute('development-access/12345678-1234-1234-1234-123456789abc', 'DELETE'), true)
  for (const [path, method] of [['development-access', 'DELETE'], ['development-access', 'PUT'], ['development-access/not-a-uuid', 'DELETE'], ['development-access/12345678-1234-1234-1234-123456789abc', 'PUT']]) assert.equal(adminRoute(path, method), false)
})

test('admin CSRF requires exact origin and explicit header', () => {
  const token = csrfToken()
  const request = headers => new Request('https://admin.example.test/api/admin/auth/login', { method: 'POST', headers: { cookie: `${CSRF_COOKIE}=${token}`, 'x-csrf-token': token, ...headers } })
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
