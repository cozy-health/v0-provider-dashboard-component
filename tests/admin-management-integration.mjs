import { reviewThemes } from './theme-design-review.mjs'
// Local contract fixtures only. No production accounts, email, or API writes.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { createIsolatedTestApp } from './isolated-next-app.mjs'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
const cell = { status: 'available', count: 15 }
const meta = { release: '2026-10-01', timezone: 'UTC', precision: 'Counts rounded down to multiples of five.', window: { from: '2026-07-03', to_exclusive: '2026-10-01' } }
let coping = [], quizzes = [], seenRange = '', forbidden = false
const backend = createServer(async (request, response) => {
 response.setHeader('Content-Type', 'application/json')
 const send = (status, value) => { response.writeHead(status); response.end(JSON.stringify(value)) }
 const url = new URL(request.url, 'http://localhost'), path = url.pathname.replace('/api/v1/admin/', '')
 let raw = ''; for await (const chunk of request) raw += chunk
 const body = raw ? JSON.parse(raw) : {}
 if (path === 'auth/login') { assert.equal(body.session_mode, 'management-v1'); return send(200, { token: 'local-management-fixture', expires_at: new Date(Date.now() + 1800000).toISOString() }) }
 if (request.headers.authorization !== 'Bearer local-management-fixture') return send(401, {})
 if (path === 'operations/summary') return send(200, { data: { checked_at: '2026-10-01T12:00:00Z', totals: {}, attention: [], activity: [] } })
  if (path === 'auth/session') return send(200, { role: 'admin', name: 'Test Operator', capabilities: ['admin:metrics', 'admin:content', 'admin:users', 'admin:email', 'admin:moderation', 'admin:subscriptions'] })
 if (path === 'auth/logout') return send(200, {})
 if (forbidden && path === 'users') return send(403, {})
 if (path === 'metrics/insights') {
  seenRange = url.searchParams.get('range')
  return send(200, { meta, data: {
   moods: [{ label: 'Good', ...cell }], triggers: [{ label: 'Work', ...cell }], coping: [{ label: 'Box breathing', ...cell }], anxiety: [{ label: '12:00', ...cell }], helpfulness: [{ label: 'Box breathing|yes', ...cell }],
   devices: [{ label: 'android', ...cell }, { label: 'ios', ...cell }], mood_trends: [{ label: '2026-09-29|Good', ...cell }], enrollments: [], completions: [], subscription_changes: [],
   daily: [{ date: '2026-09-29', signups: cell, active: cell }, { date: '2026-09-30', signups: cell, active: cell }],
   summary: { active_users: cell, new_users: cell, community_posts: cell, average_intensity: { status: 'available', count: 5.2 }, pending_reports: cell }
  } })
 }
 if (path === 'metrics/usage') return send(200, { meta, data: { features: [{ feature: 'mood_entries', ...cell }, { feature: 'quiz_attempts', ...cell }] } })
 if (path === 'metrics/retention') return send(200, { meta, data: [] })
 if (path.startsWith('content/coping') && request.method !== 'GET') {
  if (request.method === 'POST') { coping.push({ id: 1, ...body }); return send(201, { data: coping[0] }) }
  if (request.method === 'PUT') { coping[0] = { ...coping[0], ...body }; return send(200, {}) }
  if (request.method === 'DELETE') { coping[0].is_active = false; return send(200, {}) }
 }
 if (path === 'quizzes' && request.method === 'POST') { quizzes.push({ id: 1, ...body, status: 'draft' }); return send(201, {}) }
 if (/^quizzes\/1\/publish$/.test(path)) { quizzes[0].status = 'published'; return send(200, {}) }
 const rows = path === 'content/coping' ? coping : path === 'quizzes' ? quizzes : path === 'users' ? [{ id: 1, name: 'Test Person', email: 'person@example.test', is_active: true }] : []
 if (request.method === 'GET') return send(200, { data: { data: rows, current_page: 1, last_page: 1, total: rows.length }, ...(path === 'emails' ? { events: [{ id: 'welcome', name: 'Account registration' }], queue: { depth: 0, oldest_job_age_seconds: 0 } } : {}) })
 return send(404, {})
})
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve))
process.env.ADMIN_API_URL = `http://127.0.0.1:${backend.address().port}/api/v1/admin/`
process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex')
process.env.NODE_ENV = 'development'
const app = await createIsolatedTestApp('admin-management')
let server, browser, exitCode = 0
try {
 await app.prepare()
 server = createServer(app.getRequestHandler()); server.on('upgrade', app.getUpgradeHandler())
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 const origin = `http://127.0.0.1:${server.address().port}`
 process.env.ADMIN_DASHBOARD_ORIGIN = origin
 const playwright = await import(pathToFileURL(process.env.ADMIN_PLAYWRIGHT_PATH).href)
 browser = await playwright.chromium.launch({ headless: true })
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = []
 // Navigation and route assertions include cold development compilation on CI.
 page.setDefaultNavigationTimeout(120000)
 page.setDefaultTimeout(120000)
 page.on('pageerror', e => errors.push(e.message))
 await page.goto(`${origin}/admin/login`)
 await reviewThemes(page, 'admin-login')
 await page.waitForFunction(() => !document.querySelector('button[type="submit"]')?.disabled)
 await page.getByLabel('Email', { exact: true }).fill('operator@example.test')
 await page.getByLabel('Password', { exact: true }).fill('fixture-only')
 await page.getByRole('button', { name: 'Sign in', exact: true }).click()
 await page.getByRole('heading', { name: 'User registrations' }).waitFor()
 await page.getByText('Hi, Test Operator', { exact: true }).waitFor()
 assert.ok(await page.locator('.recharts-wrapper').count() >= 2)
 const navigation = page.getByRole('navigation', { name: 'Admin navigation' })
 for (const group of ['Overview', 'People & Wellness', 'Community', 'Operations']) {
   assert.ok(await navigation.getByText(group, { exact: true }).count() >= 1)
 }
 const links = navigation.getByRole('link')
 assert.equal(await navigation.locator('a .admin-icon svg').count(), await links.count())
 for (const label of ['Users', 'Cozy Moods', 'Mood Triggers', 'Cozy Quizzes', 'Email Triggers']) {
   assert.equal(await navigation.getByRole('link', { name: label, exact: true }).locator('.admin-icon[aria-hidden="true"]').count(), 1)
 }
 await navigation.getByRole('link', { name: 'Overview', exact: true }).focus()
 assert.equal(await navigation.getByRole('link', { name: 'Overview', exact: true }).evaluate(el => el === document.activeElement), true)

 await reviewThemes(page, 'admin-dashboard')
 await page.getByRole('button', { name: 'Switch to dark mode' }).click()
 await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
 assert.equal(await page.locator('.cozy-admin').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)')
 assert.deepEqual(await page.locator('.cozy-admin').first().evaluate(el => {
   const css = getComputedStyle(el);
   return ['--cozy-blue', '--cozy-green', '--cozy-orange', '--cozy-yellow', '--primary', '--chart-1', '--chart-2', '--chart-3', '--chart-4'].map(key => css.getPropertyValue(key).trim());
 }), ['#0460d8', '#00bc4c', '#f25c05', '#f2cb05', '#0460d8', '#0460d8', '#00bc4c', '#f25c05', '#f2cb05'])

 await mkdir('../docs/validation/admin-phases', { recursive: true })
 await page.screenshot({ path: '../docs/validation/admin-phases/dashboard-dark.png', fullPage: true })
 await page.reload(); await page.getByRole('heading', { name: 'User registrations' }).waitFor()
 assert.equal(await page.getByRole('button', { name: 'Switch to light mode' }).count(), 1)
 await page.getByRole('button', { name: 'Switch to light mode' }).click()
 await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))
 assert.equal(await page.locator('.cozy-admin').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)')
 assert.deepEqual(await page.locator('.cozy-admin').first().evaluate(el => {
   const css = getComputedStyle(el);
   return ['--cozy-blue', '--cozy-green', '--cozy-orange', '--cozy-yellow', '--primary', '--chart-1', '--chart-2', '--chart-3', '--chart-4'].map(key => css.getPropertyValue(key).trim());
 }), ['#0460d8', '#00bc4c', '#f25c05', '#f2cb05', '#0460d8', '#0460d8', '#00bc4c', '#f25c05', '#f2cb05'])
 await page.screenshot({ path: '../docs/validation/admin-phases/dashboard-light.png', fullPage: true })
 const rangeResponse = page.waitForResponse(response => {
  const url = new URL(response.url())
  return url.pathname === '/api/admin/metrics/insights' && url.searchParams.get('range') === '7d' && response.status() === 200
 })
 await page.getByLabel('Reporting period').selectOption('7d')
 await rangeResponse
 await page.getByRole('heading', { name: 'User registrations' }).waitFor()
 assert.equal(seenRange, '7d')
 await page.getByRole('link', { name: 'Cozy Coping Mechanisms', exact: true }).click()
 await page.getByText('There are no records to display', { exact: true }).waitFor()
 await page.getByRole('button', { name: 'Create Coping Mechanism', exact: true }).click()
 await page.getByLabel('Name', { exact: true }).fill('Walking')
 await page.getByLabel('Stable key', { exact: true }).fill('walking')
 await page.getByLabel('Description', { exact: true }).fill('A gentle walk')
 await page.getByRole('button', { name: 'Save', exact: true }).click()
 await page.locator('tbody').getByText('Walking', { exact: true }).waitFor()
 assert.equal(coping[0].slug, 'walking')
 await page.getByRole('button', { name: 'Edit', exact: true }).click()
 await page.getByLabel('Name', { exact: true }).fill('Gentle walking')
 await page.getByRole('button', { name: 'Save', exact: true }).click()
 await page.locator('tbody').getByText('Gentle walking', { exact: true }).waitFor()
 page.once('dialog', dialog => dialog.accept())
 await page.getByRole('button', { name: 'Archive', exact: true }).click()
 await page.getByText('Inactive', { exact: true }).waitFor()
 await page.getByRole('link', { name: 'Cozy Quizzes', exact: true }).click()
 await page.getByText('There are no records to display', { exact: true }).waitFor()
 await page.screenshot({ path: '../docs/validation/admin-phases/quiz-management-light.png', fullPage: true })
 await page.getByRole('button', { name: 'Create Quiz', exact: true }).click()
 await page.getByRole('button', { name: 'Preview quiz', exact: true }).click()
 await page.getByRole('heading', { name: 'Daily wellbeing check', exact: true }).waitFor()
 await page.getByRole('button', { name: 'Save draft', exact: true }).click()
 await page.locator('tbody').getByText('draft', { exact: true }).waitFor()
 await page.getByRole('button', { name: 'Publish', exact: true }).click()
 await page.locator('tbody').getByText('published', { exact: true }).waitFor()
 await page.getByRole('link', { name: 'Users', exact: true }).click()
 await page.locator('tbody').getByText('person@example.test', { exact: true }).waitFor()
 forbidden = true
 await page.reload(); await page.getByRole('alert').filter({ hasText: 'This action requires' }).waitFor()
 assert.ok(!page.url().includes('/admin/login'))
 forbidden = false
 await page.setViewportSize({ width: 390, height: 844 })
 await page.goto(`${origin}/admin`)
 await page.getByRole('heading', { name: 'User registrations' }).waitFor()
 await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
 await page.screenshot({ path: '../docs/validation/admin-phases/navigation-mobile.png', fullPage: true })
 await page.keyboard.press('Escape')
 assert.equal(await page.getByRole('button', { name: 'Open navigation', exact: true }).getAttribute('aria-expanded'), 'false')
 await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
 await page.getByRole('link', { name: 'Analytics', exact: true }).click()
 await page.getByRole('heading', { name: 'Analytics', exact: true }).waitFor()
 await reviewThemes(page, 'admin-insights')
 await page.getByRole('tab', { name: 'Wellness', exact: true }).click()
 await page.getByRole('heading', { name: 'Reported coping helpfulness' }).waitFor()
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
 await page.screenshot({ path: '../docs/validation/admin-phases/dashboard-mobile.png', fullPage: true })
 await page.evaluate(() => localStorage.removeItem('theme')); await page.reload()
 await page.emulateMedia({ colorScheme: 'dark' })
 await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
 assert.deepEqual(errors, [])
 console.log('PASS new admin flows: charts, filters, branded themes and persistence, catalog CRUD, quiz draft/preview/publish, permission errors, mobile drawer, system preference, and no runtime errors.')
} catch (error) { exitCode = 1; console.error(error) } finally {
 await browser?.close()
 if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
 await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 5000))])
 backend.closeAllConnections(); await new Promise(resolve => backend.close(resolve))
}
process.exit(exitCode)
