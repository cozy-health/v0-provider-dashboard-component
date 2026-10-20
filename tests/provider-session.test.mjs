import { CSRF_COOKIE, csrfToken } from "../lib/csrf-server.mjs"
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { sealSession, openSession, allowedRoute, validOrigin, apiBase } from '../lib/provider-session.ts'

process.env.PROVIDER_SESSION_SECRET = randomBytes(32).toString('hex')
process.env.PROVIDER_DASHBOARD_ORIGIN = 'https://dashboard.example.test'

test('messaging bridge permits only conversation reads, sends and read markers', () => {
  assert.equal(allowedRoute('conversations', 'GET'), true)
  assert.equal(allowedRoute('conversations/12/messages', 'GET'), true)
  assert.equal(allowedRoute('conversations/12/messages', 'POST'), true)
  assert.equal(allowedRoute('conversations/12/read', 'POST'), true)
  assert.equal(allowedRoute('conversations/12/messages', 'DELETE'), false)
  assert.equal(allowedRoute('conversations/12/records', 'GET'), false)
  assert.equal(allowedRoute('provider-conversations', 'GET'), false)
})

test('session encrypts credentials, authenticates ciphertext and enforces expiry', () => {
  const session = { token: 'private-provider-token', expires: Date.now() + 60000 }
  const cookie = sealSession(session)
  assert.deepEqual(openSession(cookie), session)
  assert.ok(!Buffer.from(cookie, 'base64url').toString().includes(session.token))
  const bytes = Buffer.from(cookie, 'base64url'); bytes[30] ^= 1
  assert.equal(openSession(bytes.toString('base64url')), null)
  assert.equal(openSession(sealSession({ ...session, expires: Date.now() - 1 })), null)
  assert.equal(openSession('malformed'), null)
  assert.equal(openSession(), null)
  const key = process.env.PROVIDER_SESSION_SECRET
  process.env.PROVIDER_SESSION_SECRET = randomBytes(32).toString('hex')
  assert.equal(openSession(cookie), null)
  process.env.PROVIDER_SESSION_SECRET = key
})

test('provider refresh credentials remain encrypted and cannot extend browser expiry', () => {
  const session = { token: 'access-secret', refreshToken: 'refresh-secret', expires: Date.now() + 60000 }
  const cookie = sealSession(session)
  assert.deepEqual(openSession(cookie), session)
  assert.ok(!Buffer.from(cookie, 'base64url').toString().includes('refresh-secret'))
  assert.equal(openSession(sealSession({ ...session, expires: Date.now() - 1 })), null)
})

test('CSRF requires configured exact origin and explicit request header', () => {
  const token = csrfToken()
  const request = headers => new Request('https://dashboard.example.test/api/provider/me', { method: 'PATCH', headers: { cookie: `${CSRF_COOKIE}=${token}`, 'x-csrf-token': token, ...headers } })
  assert.equal(validOrigin(request({ origin: 'https://dashboard.example.test', 'x-cozy-request': '1' })), true)
  assert.equal(validOrigin(request({ origin: 'https://evil.example.test', 'x-cozy-request': '1' })), false)
  assert.equal(validOrigin(request({ origin: 'https://dashboard.example.test' })), false)
  assert.equal(validOrigin(request({ 'x-cozy-request': '1' })), false)
})

test('bridge allowlist excludes patient routes, arbitrary paths and unauthorized methods', () => {
  for (const path of ['invitations/preview', 'invitations/connect']) {
    assert.equal(allowedRoute(path, 'POST'), true)
    assert.equal(allowedRoute(path, 'GET'), false)
    assert.equal(allowedRoute(path, 'DELETE'), false)
  }
  assert.equal(allowedRoute('quiz-shares', 'GET'), true)
  assert.equal(allowedRoute('quiz-shares/12', 'GET'), true)
  assert.equal(allowedRoute('quiz-shares/12', 'DELETE'), false)
  assert.equal(allowedRoute('quiz-shares', 'POST'), false)
  for (const path of ['me', 'clients', 'clients/12/moods', 'clients/12/resources', 'reports/12/download', 'access-log']) assert.equal(allowedRoute(path, 'GET'), true)
  for (const path of ['../../me', '/me', 'clients/12/../../me', 'me/resources', 'auth/register', 'reports/12/file', 'https://evil.test', 'clients/12/moods/1']) assert.equal(allowedRoute(path, 'GET'), false)
  assert.equal(allowedRoute('clients/12/moods', 'POST'), false)
  assert.equal(allowedRoute('resources/12', 'DELETE'), true)
})

test('production configuration requires TLS, exact API prefix and a valid encryption key', () => {
  const original = { mode: process.env.NODE_ENV, url: process.env.PROVIDER_API_URL, secret: process.env.PROVIDER_SESSION_SECRET }
  try {
    process.env.NODE_ENV = 'production'
    for (const url of ['http://127.0.0.1:8000/api/v1/provider/', 'https://api.test/', 'https://user:pass@api.test/api/v1/provider/', 'https://api.test/api/v1/provider/?x=1']) {
      process.env.PROVIDER_API_URL = url
      assert.throws(apiBase)
    }
    process.env.PROVIDER_API_URL = 'https://api.test/api/v1/provider/'
    assert.equal(apiBase().origin, 'https://api.test')
    process.env.PROVIDER_SESSION_SECRET = 'short'
    assert.throws(() => sealSession({ token: 'x', expires: Date.now() + 1000 }))
  } finally {
    if (original.mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.mode
    if (original.url === undefined) delete process.env.PROVIDER_API_URL; else process.env.PROVIDER_API_URL = original.url
    process.env.PROVIDER_SESSION_SECRET = original.secret
  }
})
