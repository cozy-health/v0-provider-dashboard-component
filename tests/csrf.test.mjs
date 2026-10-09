import assert from 'node:assert/strict'
import test from 'node:test'
import { CSRF_COOKIE, csrfCookieOptions, csrfToken, validCsrf } from '../lib/csrf-server.mjs'

test('CSRF requires matching unpredictable cookie and request token', () => {
  const token = csrfToken()
  const request = (cookie, header) => new Request('https://dashboard.example.test/api/provider/me', { headers: { cookie: `${CSRF_COOKIE}=${cookie}`, 'x-csrf-token': header } })
  assert.equal(validCsrf(request(token, token)), true)
  assert.equal(validCsrf(request(token, csrfToken())), false)
  assert.equal(validCsrf(request(token, '')), false)
  assert.equal(validCsrf(request('', token)), false)
  assert.equal(validCsrf(request('x', 'x')), false)
})

test('CSRF cookie has bounded lifetime and protects script access', () => {
  assert.equal(csrfCookieOptions.httpOnly, true)
  assert.equal(csrfCookieOptions.sameSite, 'lax')
  assert.equal(csrfCookieOptions.secure, process.env.NODE_ENV === 'production')
  assert.equal(csrfCookieOptions.path, '/')
  assert.equal(csrfCookieOptions.maxAge, 3600)
})
