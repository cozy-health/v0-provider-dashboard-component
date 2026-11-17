// All accounts and grants are isolated fixtures. No live emails or paid access.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { createIsolatedTestApp } from './isolated-next-app.mjs'

let enabled = true, grants = [], writes = 0
const id = '12345678-1234-1234-1234-123456789abc'
const backend = createServer(async (request, response) => {
 const url = new URL(request.url, 'http://localhost'), path = url.pathname.replace('/api/v1/admin/', '')
 const send = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)) }
 let raw = ''; for await (const chunk of request) raw += chunk
 if (path === 'auth/login') return send({ token: 'development-access-fixture', expires_at: new Date(Date.now() + 1800000).toISOString() })
 if (request.headers.authorization !== 'Bearer development-access-fixture') return send({}, 401)
 if (path === 'auth/session') return send({ role: 'admin', name: 'Test access reviewer', capabilities: ['admin:subscriptions', ...(enabled ? ['admin:development-access'] : [])] })
 if (path === 'operations/summary') return send({ data: { totals: {}, attention: [], activity: [], checked_at: new Date().toISOString() } })
 if (path.startsWith('metrics/')) return send({ meta: { release: '2026-10-01', timezone: 'UTC', window: { from: '2026-09-01', to_exclusive: '2026-10-01' } }, data: path === 'metrics/retention' ? [] : { summary: {}, daily: [], moods: [], triggers: [], coping: [], helpfulness: [], mood_trends: [], devices: [], enrollments: [], completions: [], subscription_changes: [], features: [] } })
 if (path.startsWith('development-access')) {
  if (!enabled) return send({ message: 'Unavailable outside development.' }, 404)
  if (request.method === 'GET') { assert.deepEqual([...url.searchParams.keys()], ['page']); return send({ development_only: true, data: { data: grants, last_page: 1 } }) }
  writes++
  if (request.method === 'POST') {
   const body = JSON.parse(raw); assert.equal(body.email, 'tester@example.test'); assert.equal(body.plan, 'student'); assert.equal(body.duration_days, 7)
   if (grants.some(grant => grant.status === 'active')) return send({}, 409)
   grants = [{ id, email: body.email, plan: body.plan, status: 'active', expires_at: '2099-01-01T00:00:00Z', revoked_at: null }]
   return send({ development_only: true, data: { id } }, 201)
  }
  assert.equal(path, `development-access/${id}`); assert.equal(request.method, 'DELETE')
  grants[0] = { ...grants[0], status: 'revoked', revoked_at: new Date().toISOString() }
  return send({})
 }
 return send({})
})
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve))
process.env.ADMIN_API_URL = `http://127.0.0.1:${backend.address().port}/api/v1/admin/`
process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex')
process.env.NODE_ENV = 'development'
const app = await createIsolatedTestApp('development-access')
let server, browser, exitCode = 0
try {
 await app.prepare(); server = createServer(app.getRequestHandler()); server.on('upgrade', app.getUpgradeHandler())
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 const origin = `http://127.0.0.1:${server.address().port}`; process.env.ADMIN_DASHBOARD_ORIGIN = origin
 const { chromium } = await import(pathToFileURL(process.env.ADMIN_PLAYWRIGHT_PATH).href)
 browser = await chromium.launch({ headless: true })
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = []
 page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(120000); page.on('pageerror', error => errors.push(error.message))
 await page.goto(origin + '/admin/login')
 await page.getByLabel('Email', { exact: true }).fill('admin@example.test'); await page.getByLabel('Password', { exact: true }).fill('fixture-only')
 await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL(origin + '/admin')
 await page.goto(origin + '/admin/manage/development-access')
 assert.equal(await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('link', { name: 'Development test access', exact: true }).count(), 1)
 await page.getByText('No test access has been granted.', { exact: true }).waitFor()
 await page.getByLabel('Development account email', { exact: true }).fill('tester@example.test')
 await page.getByLabel('Test plan', { exact: false }).selectOption('student')
 await page.getByLabel('Access duration in days', { exact: true }).fill('31')
 await page.getByLabel('Testing reason', { exact: false }).fill('Testing student feature access')
 await page.getByRole('button', { name: 'Review test access', exact: true }).click()
 assert.equal(await page.getByRole('dialog').count(), 0); assert.equal(writes, 0)
 await page.getByLabel('Access duration in days', { exact: true }).fill('7')
 await page.getByRole('button', { name: 'Review test access', exact: true }).click()
 const dialog = page.getByRole('dialog'); await dialog.waitFor()
 assert.match(await dialog.innerText(), /tester@example.test.*student.*7 days/)
 await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(writes, 0)
 await page.getByRole('button', { name: 'Review test access', exact: true }).click()
 await dialog.getByRole('button', { name: 'Grant test access', exact: true }).click()
 await page.getByRole('status').filter({ hasText: 'Development test access granted. No payment was collected.' }).waitFor()
 await page.getByRole('button', { name: 'Revoke test access', exact: true }).waitFor(); assert.equal(writes, 1)
 const shots = '../output/development-access-preview'; await mkdir(shots, { recursive: true })
 await page.screenshot({ path: `${shots}/desktop-light.png`, fullPage: true })
 await page.getByRole('button', { name: 'Switch to dark mode' }).click()
 await page.setViewportSize({ width: 390, height: 844 })
 await page.screenshot({ path: `${shots}/phone-dark.png`, fullPage: true })
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
 await page.getByRole('button', { name: 'Revoke test access', exact: true }).click()
 await dialog.getByRole('button', { name: 'Confirm revocation', exact: true }).click()
 await page.getByRole('status').filter({ hasText: 'Development test access revoked. Any genuine subscription is unchanged.' }).waitFor()
 await page.getByText(/student · Revoked/).waitFor(); assert.equal(writes, 2)
 enabled = false
 await page.goto(origin + '/admin/manage/development-access')
 await page.getByRole('alert').waitFor()
 assert.equal(await page.getByRole('button', { name: 'Review test access', exact: true }).count(), 0)
 assert.equal(await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('link', { name: 'Development test access', exact: true }).count(), 0)
 assert.deepEqual(errors, [])
 console.log('PASS development access: scoped navigation, duration bounds, confirmation/cancel, grant, revoke, responsive themes and disabled environment')
} catch (error) { console.error(error); exitCode = 1 }
finally { await browser?.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }; await app.close(); backend.closeAllConnections(); await new Promise(resolve => backend.close(resolve)) }
process.exit(exitCode)
