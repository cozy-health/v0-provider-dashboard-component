// Isolated contract fixtures: no live accounts, emails or external writes.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createIsolatedTestApp } from './isolated-next-app.mjs'

let capabilities = ['admin:subscriptions'], failures = 0
const rows = (data, page = 1, last = 1, total = data.length) => ({ data: { data, current_page: page, last_page: last, total } })
let packageRow = { id: 1, package_name: 'Original package', slug: 'mobile-ng-student', description: 'Fixture', is_active: true, audience: 'mobile', country_code: 'NG', tier: 'student', price: 5000, currency: 'NGN', currency_decimals: 2, annual_discount: 20, duration: 'monthly', duration_days: 30, features: ['Fixture'], sort_order: 0, version: 'a'.repeat(64), updated_at: '2026-10-01 12:00:00' }
const backend = createServer(async (request, response) => {
 const path = new URL(request.url, 'http://localhost').pathname.replace('/api/v1/admin/', '')
 const send = value => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)) }
 if (path === 'auth/login') return send({ token: 'admin-repair-fixture', expires_at: new Date(Date.now() + 1800000).toISOString() })
 if (path === 'auth/session') return send({ role: 'admin', name: 'Repair reviewer', capabilities })
 if (path === 'student-applications') return send(rows([]))
 if (path === 'operations/summary') return send({ data: { totals: {}, attention: [], activity: [], checked_at: new Date().toISOString() } })
 if (path.startsWith('metrics/')) {
  const meta = { release: '2026-10-01', timezone: 'UTC', window: { from: '2026-09-01', to_exclusive: '2026-10-01' } }
  return send({ meta, data: path === 'metrics/retention' ? [] : { summary: {}, daily: [], moods: [], triggers: [], coping: [], helpfulness: [], mood_trends: [], devices: [], enrollments: [], completions: [], subscription_changes: [], features: [] } })
 }
 return send(rows([]))
})
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve))
process.env.ADMIN_API_URL = `http://127.0.0.1:${backend.address().port}/api/v1/admin/`
process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex')
process.env.NODE_ENV = 'development'
const app = await createIsolatedTestApp('admin-repairs')
let server, browser
try {
 await app.prepare()
 server = createServer(app.getRequestHandler()); server.on('upgrade', app.getUpgradeHandler())
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 const origin = `http://127.0.0.1:${server.address().port}`
 process.env.ADMIN_DASHBOARD_ORIGIN = origin
 const { chromium } = await import(pathToFileURL(process.env.ADMIN_PLAYWRIGHT_PATH).href)
 browser = await chromium.launch({ headless: true })
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
 page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(120000)
 const errors = []; page.on('pageerror', error => errors.push(error.message))
 await page.goto(origin + '/admin/login')
 await page.getByLabel('Email', { exact: true }).fill('reviewer@example.test')
 await page.getByLabel('Password', { exact: true }).fill('fixture-only')
 await page.getByRole('button', { name: 'Sign in', exact: true }).click()
 await page.waitForURL(origin + '/admin')
 async function check(name, run) { try { await run(); console.log('PASS ' + name) } catch (error) { failures++; console.error('FAIL ' + name + ': ' + error.message) } }
 await check('Student navigation follows subscriptions permission', async () => {
  await page.goto(origin + '/admin/manage/student-applications')
  assert.equal(await page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('link', { name: 'Student Verification', exact: true }).count(), 1)
 })
 capabilities = ['admin:content', 'admin:moderation']
 await check('Content-only staff do not see Student review or package administration', async () => {
  await page.goto(origin + '/admin/manage/packages')
  const nav = page.getByRole('navigation', { name: 'Admin navigation' })
  assert.equal(await nav.getByRole('link', { name: 'Student Verification', exact: true }).count(), 0)
  assert.equal(await nav.getByRole('link', { name: 'Packages', exact: true }).count(), 0)
 })
 let releaseFilter, filterStarted = false, memberTotal = 11, packageSaves = 0
 await page.route('**/api/admin/**', async route => {
  const url = new URL(route.request().url()), path = url.pathname.replace('/api/admin/', ''), method = route.request().method()
  const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  if (path === 'reports') {
   if (url.searchParams.get('status') === 'pending') { filterStarted = true; await new Promise(resolve => { releaseFilter = resolve }); return send(rows([])) }
   return send(rows([{ id: 8, target_type: 'post', reason: 'OLD RESOLVED ROW', status: 'resolved' }]))
  }
  if (path === 'community/members' && method === 'GET') {
   const requested = Number(url.searchParams.get('page') || 1), last = Math.ceil(memberTotal / 10)
   return send(rows(requested > last ? [] : [{ id: requested === 2 ? 11 : 1, group_id: 1, name: requested === 2 ? 'Last member' : 'First member' }], requested, last, memberTotal))
  }
  if (path === 'community/members/11' && method === 'DELETE') { memberTotal = 10; return send({}) }
  if (path === 'content/packages' && method === 'GET') return send(rows([packageRow]))
  if (path === 'content/packages/1' && method === 'GET') return send({ data: packageRow })
  if (path === 'content/packages/1' && method === 'PUT') {
   packageSaves++
   if (packageSaves === 1) { packageRow = { ...packageRow, package_name: 'Updated package', version: 'b'.repeat(64) }; return send({ message: 'Changed. Reload and retry.' }, 409) }
   assert.equal(route.request().postDataJSON().expected_version, packageRow.version)
   return send({})
  }
  return route.continue()
 })
 await check('Filter transition never displays rows belonging to previous filter', async () => {
  await page.goto(origin + '/admin/manage/reports')
  await page.getByText('OLD RESOLVED ROW', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Pending reports', exact: true }).click()
  await page.waitForFunction(() => location.search.includes('status=pending'))
  for (let attempt = 0; attempt < 100 && !filterStarted; attempt++) await page.waitForTimeout(20)
  assert.equal(filterStarted, true)
  assert.equal(await page.getByText('OLD RESOLVED ROW', { exact: true }).count(), 0)
 })
 releaseFilter?.()
 await check('Removing last row clamps to the last available page', async () => {
  await page.goto(origin + '/admin/manage/members?page=2')
  await page.getByText('Last member', { exact: true }).waitFor()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Remove membership', exact: true }).click()
  await page.getByText('First member', { exact: true }).waitFor({ timeout: 10000 })
  assert.equal(new URL(page.url()).searchParams.get('page'), '1')
 })
 await check('Package conflict reloads current values and version inside dialog', async () => {
  await page.goto(origin + '/admin/manage/packages')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  const reload = dialog.getByRole('button', { name: 'Reload package', exact: true })
  await reload.waitFor({ timeout: 10000 })
  assert.equal(await dialog.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true)
  await reload.click()
  await page.waitForFunction(() => document.querySelector('[role=dialog] input[name=package_name]')?.value === 'Updated package')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(packageSaves, 2)
 })
 await check('Student decision removes evidence controls and displays deletion outcome', async () => {
  const id = '12345678-1234-1234-1234-123456789abc'
  let application = { id, institution: 'Fictional University', status: 'pending', institution_email: 'student@example.test', email_verified_at: null, eligible_until: null, evidence_available: true, evidence_cleanup_pending: false, review_note: null }
  await page.route('**/api/admin/student-applications**', async route => {
   if (route.request().method() === 'POST') {
    const body = route.request().postDataJSON()
    assert.equal(body.decision, 'rejected')
    application = { ...application, status: 'rejected', evidence_available: false, review_note: body.note }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ application, evidence_deleted: true }) })
   }
   return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { data: [application], last_page: 1 } }) })
  })
  await page.goto(origin + '/admin/manage/student-applications')
  await page.getByRole('button', { name: 'Review application', exact: true }).click()
  await page.getByLabel('Decision reason (shown to the student)', { exact: true }).fill('Please provide your current semester course form.')
  await page.getByRole('button', { name: 'Reject and delete evidence', exact: true }).click()
  await page.getByText('Decision saved. The evidence document was deleted.', { exact: true }).waitFor()
  await page.getByText('No evidence document is available.', { exact: true }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Download private enrolment evidence', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Review application', exact: true }).count(), 0)
 })
 await check('Cozy Moods uses the matching original mobile illustrations', async () => {
  const moods = ['angry', 'sad', 'good', 'upset', 'spectacular', 'happy']
  await page.route('**/api/admin/content/moods?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(rows(moods.map((slug, index) => ({ id: index + 1, slug, name: slug, description: 'Fixture mood', is_active: true })))) }))
  await page.goto(origin + '/admin/manage/moods')
  for (const mood of moods) {
   const image = page.getByRole('img', { name: `${mood} mood illustration`, exact: true })
   await image.waitFor()
   assert.equal(await image.getAttribute('src'), `/images/moods/${mood}.png`)
   await image.evaluate(element => element.decode())
  }
 })
 assert.deepEqual(errors, [])
} finally {
 await browser?.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
 await app.close(); backend.closeAllConnections(); await new Promise(resolve => backend.close(resolve))
}
process.exit(failures ? 1 : 0)
