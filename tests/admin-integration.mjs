// Isolated aggregate contract fixture. No production users or real credentials.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { ADMIN_COOKIE, sealAdmin } from '../lib/admin-session.ts'
import { SESSION_COOKIE, sealSession } from '../lib/provider-session.ts'
const require = createRequire(import.meta.url), next = require('next')
const suppressed = { status: 'suppressed', count: '<5' }, available = { status: 'available', count: 5 }
const cohort = { week: '2026-07-20', signups: available, retention: { d1: { ...available, cohort: 10, rate: 50 }, d7: suppressed, d30: { status: 'immature', count: null, cohort: null, rate: null } } }
const meta = { release: '2026-10-01', timezone: 'UTC', precision: 'Counts rounded down to multiples of 5.', window: { from: '2026-07-03', to_exclusive: '2026-10-01' }, activity_definition: 'Retained consumer record creation.' }
const operations = { api: 'ok', database: 'ok', checked_at: '2026-10-09T12:00:00Z', source: 'Current request; no historical window.', ...Object.fromEntries(['availability_history', 'latency_p95', 'latency_p99', 'error_rate', 'queue_health', 'deployment'].map(key => [key, { status: 'unavailable' }])) }
let availableService = true, revoked = false, empty = false, backendCalls = 0, seenRange = null
const backend = createServer(async (request, response) => {
  backendCalls++
  const url = new URL(request.url, 'http://localhost'), path = url.pathname.replace('/api/v1/admin/', '')
  response.setHeader('Content-Type', 'application/json')
  const send = (code, body) => { response.writeHead(code); response.end(JSON.stringify(body)) }
  if (['/api/v1/auth/forgot-password', '/api/v1/provider/auth/forgot-password'].includes(url.pathname)) {
    response.setHeader('Retry-After', '125')
    return send(429, { message: 'Too many requests.' })
  }
  if (!availableService) return send(500, { message: 'DO NOT EXPOSE INTERNAL EXCEPTION' })
  if (path === 'auth/login') {
    let raw = ''; for await (const chunk of request) raw += chunk
    const body = JSON.parse(raw)
    if (body.email !== 'operator@example.test' || body.password !== 'fixture-only') return send(422, {})
    revoked = false; return send(200, { token: 'fixture-admin-token', expires_at: new Date(Date.now() + 1800000).toISOString() })
  }
  if (request.headers.authorization !== 'Bearer fixture-admin-token' || revoked) return send(403, {})
  if (path === 'auth/session') return send(200, { role: 'admin' })
  if (path === 'auth/logout') { revoked = true; return send(200, { message: 'Signed out.' }) }
  const metric = path.replace('metrics/', '')
  seenRange = url.searchParams.get('range')
  const data = metric === 'overview' ? { daily_activity: empty ? [] : [{ date: '2026-09-29', ...available }, { date: '2026-09-28', ...suppressed }], signup_trend: empty ? [] : [{ week: cohort.week, ...suppressed }], retention_summary: empty ? [] : [cohort], operations }
    : metric === 'usage' ? { range: seenRange || '30d', features: empty ? [] : [{ feature: 'mood_entries', ...available }, { feature: 'journal_entries', ...suppressed }], unavailable_features: ['app_opens'] }
    : metric === 'retention' ? empty ? [] : [cohort]
    : empty ? [] : [{ range: '7d', ...suppressed }, { range: '30d', ...suppressed }, { range: '90d', ...suppressed }]
  send(200, { meta, data })
})
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve))
process.env.ADMIN_API_URL = `http://127.0.0.1:${backend.address().port}/api/v1/admin/`
process.env.PROVIDER_API_URL = `http://127.0.0.1:${backend.address().port}/api/v1/provider/`
process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex')
process.env.PROVIDER_SESSION_SECRET = randomBytes(32).toString('hex')
const app = next({ dev: true, dir: process.cwd() })
let server, browser, exitCode = 0
try {
  await app.prepare()
  server = createServer(app.getRequestHandler()); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`; process.env.ADMIN_DASHBOARD_ORIGIN = origin; process.env.PROVIDER_DASHBOARD_ORIGIN = origin
  const csrfResponse = await fetch(`${origin}/api/csrf`)
  const csrfCookie = csrfResponse.headers.get('set-cookie').split(';')[0]
  const csrf = (await csrfResponse.json()).token
  let cookie = ''
  const request = (path, method = 'GET', data, extras = {}) => fetch(`${origin}/api/admin/${path}`, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', Origin: origin, 'X-Cozy-Request': '1', 'X-CSRF-Token': csrf, Cookie: `${cookie}; ${csrfCookie}`, ...extras }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) })
  const resetThrottle = await fetch(`${origin}/api/admin-password/forgot-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'X-Cozy-Request': '1', 'X-CSRF-Token': csrf, Cookie: csrfCookie },
    body: JSON.stringify({ email: 'operator@example.test' }),
  })
  assert.equal(resetThrottle.status, 429)
  assert.equal(resetThrottle.headers.get('Retry-After'), '125')
  assert.match((await resetThrottle.json()).message, /Try again in 3 minutes/)
  const providerThrottle = await fetch(`${origin}/api/provider/auth/forgot-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'X-Cozy-Request': '1', 'X-CSRF-Token': csrf, Cookie: csrfCookie },
    body: JSON.stringify({ email: 'provider@example.test' }),
  })
  assert.equal(providerThrottle.status, 429)
  assert.equal(providerThrottle.headers.get('Retry-After'), '125')
  assert.match((await providerThrottle.json()).message, /Try again in 3 minutes/)
  assert.equal((await fetch(`${origin}/admin`, { redirect: 'manual' })).status, 307)
  assert.equal((await request('metrics/overview')).status, 401)
  assert.equal((await request('auth/login', 'POST', {}, { Origin: 'https://evil.test' })).status, 403)
  assert.equal((await request('auth/login', 'POST', { email: 'patient@example.test', password: 'fixture-only' })).status, 422)
  const login = await request('auth/login', 'POST', { email: 'operator@example.test', password: 'fixture-only' })
  assert.equal(login.status, 200); assert.deepEqual(await login.json(), { role: 'admin' })
  cookie = login.headers.get('set-cookie').split(';')[0]
  assert.match(login.headers.get('set-cookie'), /HttpOnly/); assert.match(login.headers.get('set-cookie'), /SameSite=lax/i)
  assert.ok(!cookie.includes('fixture-admin-token'))
  assert.equal((await request('metrics/overview')).status, 200)
  const before = backendCalls
  assert.equal((await request('clients')).status, 404)
  assert.equal((await request('metrics/safety?user_id=1')).status, 422)
  assert.equal((await request('auth/register', 'POST', {})).status, 404)
  assert.equal((await request('auth/login', 'POST', { email: 'x'.repeat(9000) })).status, 413)
  assert.equal(backendCalls, before)
  const adminCookie = cookie
  cookie = `${SESSION_COOKIE}=${sealSession({ token: 'fixture-admin-token', expires: Date.now() + 60000 })}`
  assert.equal((await request('metrics/overview')).status, 401)
  cookie = `${ADMIN_COOKIE}=${sealAdmin({ token: 'fixture-admin-token', expires: 0 })}`
  assert.equal((await request('metrics/overview')).status, 401)
  cookie = adminCookie; availableService = false
  const failure = await request('metrics/overview'); assert.equal(failure.status, 500); assert.ok(!(await failure.text()).includes('INTERNAL EXCEPTION'))
  availableService = true; revoked = true
  assert.equal((await fetch(`${origin}/admin`, { headers: { Cookie: cookie }, redirect: 'manual' })).status, 307)
  const denied = await request('metrics/overview'); assert.equal(denied.status, 403); assert.match(denied.headers.get('set-cookie'), /Max-Age=0/)
  revoked = false
  console.log('PASS admin HTTP: separate cookie, CSRF, scope, config, expiry, revocation, role page check, body bounds and sanitized failures')
  const playwrightPath = process.env.ADMIN_PLAYWRIGHT_PATH || process.env.PROVIDER_PLAYWRIGHT_PATH
  if (!playwrightPath) throw new Error('Set ADMIN_PLAYWRIGHT_PATH for the required browser checks.')
  const playwright = await import(pathToFileURL(playwrightPath).href)
  browser = await playwright.chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') console.error('Browser console:', message.text()) })
  await page.goto(`${origin}/admin`)
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]')?.disabled)
  await page.getByLabel('Email', { exact: true }).fill('operator@example.test')
  await page.getByLabel('Password', { exact: true }).fill('fixture-only')
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await page.getByRole('button', { name: 'Hide password', exact: true }).waitFor()
  assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'text')
  assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), 'fixture-only')
  await page.getByRole('button', { name: 'Hide password', exact: true }).press('Enter')
  await page.getByRole('button', { name: 'Show password', exact: true }).waitFor()
  assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'password')
  assert.match(page.url(), /admin\/login$/)
  await page.screenshot({ path: '../docs/AUTH_ADMIN_LOGIN.png', fullPage: true })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: 'Current service health' }).waitFor()
  assert.ok(!(await page.evaluate(() => document.cookie)).includes('cozy-admin'))
  assert.ok(!(await page.locator('body').innerText()).includes('fixture-admin-token'))
  await page.screenshot({ path: '../docs/PD7_ADMIN_OVERVIEW.png', fullPage: true })
  await page.getByRole('link', { name: 'Usage', exact: true }).click()
  await page.getByRole('heading', { name: 'Stored feature records · 30d' }).waitFor()
  await page.getByLabel('Reporting range').selectOption('7d')
  await page.getByRole('heading', { name: 'Stored feature records · 7d' }).waitFor(); assert.equal(seenRange, '7d')
  await page.getByRole('link', { name: 'Retention', exact: true }).click()
  await page.getByText('Not mature', { exact: true }).waitFor()
  assert.equal(await page.locator('tbody td').filter({ hasText: '<5' }).count(), 1)
  await page.getByRole('link', { name: 'Safety', exact: true }).click()
  await page.getByText('This view has no publishable counts yet.', { exact: false }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '../docs/PD7_ADMIN_MOBILE.png', fullPage: true })
  empty = true; await page.reload(); await page.getByText('No reporting buckets are available for this release.').waitFor()
  empty = false; availableService = false
  // Layout validates identity first; service failure must not display metrics.
  await page.reload(); await page.getByRole('heading', { name: 'Admin access could not be checked' }).waitFor()
  availableService = true; await page.getByRole('link', { name: 'Retry', exact: true }).click()
  await page.getByRole('heading', { name: 'Current service health' }).waitFor()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByRole('heading', { name: 'Admin sign in' }).waitFor()
  await page.goto(`${origin}/admin/login?expired=1`)
  await page.getByRole('status').filter({ hasText: 'Your session ended.' }).waitFor()
  let resetRequests = 0, codeRequests = 0
  await page.route('**/api/admin-password/*', async route => {
    const data = route.request().postDataJSON()
    assert.equal(data.email, 'operator@example.test')
    if (route.request().url().endsWith('forgot-password')) {
      codeRequests++
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Generic reset notice.' }) })
    }
    resetRequests++
    assert.equal(data.token, '123456')
    if (resetRequests === 1) return route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, contentType: 'application/json', body: JSON.stringify({ message: 'Too many attempts. Please retry.' }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Password reset.' }) })
  })
  await page.getByRole('link', { name: 'Reset it here' }).click()
  await page.waitForURL('**/admin/reset-password')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email', { exact: true }).fill('OPERATOR@example.test')
  await page.getByRole('button', { name: 'Send reset code', exact: true }).click()
  await page.getByLabel('6-digit reset code').waitFor()
  await page.clock.install()
  assert.equal(await page.getByLabel('Email', { exact: true }).inputValue(), 'operator@example.test')
  assert.equal(await page.getByLabel('Email', { exact: true }).getAttribute('readonly'), '')
  assert.equal(await page.getByRole('button', { name: /Resend code in/ }).isDisabled(), true)
  await page.getByLabel('6-digit reset code').fill('123456')
  await page.getByLabel('New password', { exact: true }).fill('FixturePasswordOnly!')
  await page.getByRole('button', { name: 'Show new password', exact: true }).click()
  assert.equal(await page.getByLabel('New password', { exact: true }).getAttribute('type'), 'text')
  assert.equal(await page.getByLabel('Confirm password', { exact: true }).getAttribute('type'), 'password')
  await page.getByRole('button', { name: 'Hide new password', exact: true }).click()
  await page.getByLabel('Confirm password', { exact: true }).fill('DifferentFixtureOnly!')
  await page.getByRole('button', { name: 'Reset password', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Passwords must match.' }).waitFor()
  assert.equal(resetRequests, 0)
  await page.clock.fastForward(61000)
  await page.getByRole('button', { name: 'Resend code', exact: true }).click()
  await page.getByRole('button', { name: /Resend code in/ }).waitFor()
  assert.equal(codeRequests, 2)
  assert.equal(await page.getByLabel('New password', { exact: true }).inputValue(), 'FixturePasswordOnly!')
  await page.getByLabel('Confirm password', { exact: true }).fill('FixturePasswordOnly!')
  await page.screenshot({ path: '../docs/AUTH_ADMIN_RESET_MOBILE.png', fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  await page.getByRole('button', { name: 'Reset password', exact: true }).click()
  await page.getByRole('button', { name: /Try again in/ }).waitFor()
  assert.equal(await page.getByRole('button', { name: /Try again in/ }).isDisabled(), true)
  await page.clock.fastForward(3000)
  await page.getByRole('button', { name: 'Reset password', exact: true }).click()
  await page.waitForURL('**/admin/login')
  await page.getByText('Password reset. Log in with your new one.', { exact: true }).waitFor()
  assert.equal(resetRequests, 2)
  assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), '')

  let providerResetRequests = 0
  await page.route('**/api/provider/auth/*', async route => {
    const data = route.request().postDataJSON()
    assert.equal(data.email, 'provider@example.test')
    if (route.request().url().endsWith('reset-password')) providerResetRequests++
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Generic fixture response.' }) })
  })
  await page.goto(`${origin}/login`)
  await page.getByLabel('Email', { exact: true }).fill('PROVIDER@example.test')
  await page.getByLabel('Password', { exact: true }).fill('fixture-only')
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'text')
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click()
  assert.equal(await page.getByLabel('Email', { exact: true }).inputValue(), 'PROVIDER@example.test')
  await page.getByRole('button', { name: 'Send reset code', exact: true }).click()
  await page.getByLabel('Six-digit code').fill('123456')
  await page.getByLabel('New password', { exact: true }).fill('ProviderFixtureOnly!')
  await page.getByLabel('Confirm password', { exact: true }).fill('DifferentFixtureOnly!')
  await page.getByRole('button', { name: 'Reset password', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Passwords must match.' }).waitFor()
  assert.equal(providerResetRequests, 0)
  await page.getByLabel('Confirm password', { exact: true }).fill('ProviderFixtureOnly!')
  await page.getByRole('button', { name: 'Show confirm password', exact: true }).click()
  assert.equal(await page.getByLabel('Confirm password', { exact: true }).getAttribute('type'), 'text')
  await page.getByRole('button', { name: 'Reset password', exact: true }).click()
  await page.getByRole('heading', { name: 'Provider sign in', exact: true }).waitFor()
  await page.getByText('Password reset. Sign in with your new password.', { exact: true }).waitFor()
  assert.equal(await page.locator('[role="alert"].text-destructive').count(), 0)
  assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), '')
  assert.equal(providerResetRequests, 1)
  console.log('PASS auth UX: password visibility, keyboard toggle, expired notice, email retention, resend cooldown, validation, 429 recovery, reset success and mobile layout; fixture requests only')
  assert.deepEqual(errors, [])
  console.log('PASS admin browser: login, protected navigation, range changes, suppression/immaturity, empty/service-error states, narrow viewport, logout; no runtime errors')
} catch (error) { exitCode = 1; console.error(error) }
finally {
  await browser?.close()
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 5000))])
  backend.closeAllConnections(); await new Promise(resolve => backend.close(resolve))
}
process.exit(exitCode)
