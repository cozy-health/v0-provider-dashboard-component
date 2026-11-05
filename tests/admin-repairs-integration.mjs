// Isolated contract fixtures: no live accounts, emails or external writes.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createIsolatedTestApp } from './isolated-next-app.mjs'

let capabilities = ['admin:subscriptions'], failures = 0
let studentDomains = []
let schoolRequest = { id: '12345678-1234-1234-1234-123456789abc', domain: 'school.synthetic.example', institution: 'Synthetic Nigerian School', website: 'https://school.synthetic.example', status: 'pending' }
const rows = (data, page = 1, last = 1, total = data.length) => ({ data: { data, current_page: page, last_page: last, total } })
let packageRow = { id: 1, package_name: 'Original package', slug: 'mobile-ng-student', description: 'Fixture', is_active: true, audience: 'mobile', country_code: 'NG', tier: 'student', price: 5000, currency: 'NGN', currency_decimals: 2, annual_discount: 20, duration: 'monthly', duration_days: 30, features: ['Fixture'], sort_order: 0, version: 'a'.repeat(64), updated_at: '2026-10-01 12:00:00' }
const backend = createServer(async (request, response) => {
 const path = new URL(request.url, 'http://localhost').pathname.replace('/api/v1/admin/', '')
 const send = value => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)) }
 if (path === 'auth/login') return send({ token: 'admin-repair-fixture', expires_at: new Date(Date.now() + 1800000).toISOString() })
 if (path === 'auth/session') return send({ role: 'admin', name: 'Repair reviewer', capabilities })
 if (path === 'student-school-requests' && request.method === 'GET') return send(rows([schoolRequest]))
 if (path === `student-school-requests/${schoolRequest.id}/review` && request.method === 'POST') {
  let raw = ''; for await (const chunk of request) raw += chunk
  const body = JSON.parse(raw); assert.equal(body.nigerian_tertiary_confirmed, true); assert.equal(body.institution_type, 'university'); assert.equal(body.decision, 'approved'); assert.ok(body.note.length >= 5)
  schoolRequest = { ...schoolRequest, status: body.decision }; return send({ message: 'School request reviewed.' })
 }
 if (path === 'student-applications') return send(rows([]))
 if (path === 'student-email-domains' && request.method === 'GET') return send(rows(studentDomains))
 if (path === 'student-email-domains' && request.method === 'POST') {
  let raw = ''; for await (const chunk of request) raw += chunk
  const body = JSON.parse(raw); assert.equal(body.nigerian_tertiary_confirmed, true)
  studentDomains = [{ id: 1, domain: body.domain.toLowerCase(), institution: body.institution, enabled: true, version: 1 }]
  response.statusCode = 201; return send({ data: studentDomains[0] })
 }
 if (path === 'student-email-domains/1' && request.method === 'PUT') {
  let raw = ''; for await (const chunk of request) raw += chunk
  const body = JSON.parse(raw), row = studentDomains[0]
  if (body.version !== row.version) { response.statusCode = 409; return send({ message: 'Domain changed' }) }
  studentDomains = [{ ...row, enabled: body.enabled, version: row.version + 1 }]
  return send({ data: studentDomains[0] })
 }
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
 await check('School domain review uses scoped proxy and preserves mailbox verification requirement', async () => {
  const section = page.locator('section[aria-labelledby="school-requests-heading"]')
  await section.getByRole('heading', { name: 'Synthetic Nigerian School' }).waitFor()
  await section.getByLabel('Decision', { exact: true }).selectOption('approved')
  await section.getByLabel('Institution type', { exact: true }).selectOption('university')
  await section.getByRole('checkbox').check()
  await section.getByLabel('Decision reason and source references').fill('Official Nigerian registry and school email policy checked')
  await section.getByRole('button', { name: 'Save school decision' }).click()
  await section.getByText('Decision saved. Students must still verify their own school mailbox.').waitFor()
  assert.equal(schoolRequest.status, 'approved')
  assert.equal(await section.getByRole('button', { name: 'Save school decision' }).count(), 0)
  assert.ok((await section.innerText()).includes('team@cozyhealth.org and cozyhealth.hq@gmail.com'))
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
 await check('A delayed Student decision refreshes the current page without restoring old rows', async () => {
  const first = { id: '11111111-1111-4111-8111-111111111111', institution: 'First page student', status: 'pending', institution_email: null, email_verified_at: null, eligible_until: null, evidence_available: true, evidence_cleanup_pending: false, review_note: null }
  const second = { ...first, id: '22222222-2222-4222-8222-222222222222', institution: 'Second page student' }
  let releaseReview, resolveStarted, resolveReload
  const reviewGate = new Promise(resolve => { releaseReview = resolve })
  const reviewStarted = new Promise(resolve => { resolveStarted = resolve })
  const listReloaded = new Promise(resolve => { resolveReload = resolve })
  let reviewed = false
  const handler = async route => {
   if (route.request().method() === 'POST') {
    resolveStarted(); await reviewGate; reviewed = true
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ application: { ...first, status: 'rejected', evidence_available: false }, evidence_deleted: true }) })
   }
   const pageNumber = Number(new URL(route.request().url()).searchParams.get('page') || '1')
   await route.fulfill({ contentType: 'application/json', body: JSON.stringify(rows([pageNumber === 2 ? second : { ...first, status: reviewed ? 'rejected' : 'pending' }], pageNumber, 2, 21)) })
   if (reviewed) resolveReload()
  }
  await page.route('**/api/admin/student-applications**', handler)
  try {
   await page.goto(origin + '/admin/manage/student-applications')
   await page.getByRole('heading', { name: 'First page student', exact: true }).waitFor()
   await page.getByRole('button', { name: 'Review application', exact: true }).click()
   await page.getByLabel('Decision reason (shown to the student)', { exact: true }).fill('Please provide current registration evidence.')
   await page.getByRole('button', { name: 'Reject and delete evidence', exact: true }).click()
   await reviewStarted
   await page.getByRole('button', { name: 'Next', exact: true }).click()
   await page.getByRole('heading', { name: 'Second page student', exact: true }).waitFor()
   releaseReview(); await listReloaded
   await page.getByText('Decision saved. The evidence document was deleted.', { exact: true }).waitFor()
   await page.getByText('Loading student applications…', { exact: true }).waitFor({ state: 'hidden' })
   await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
   assert.equal(await page.getByRole('heading', { name: 'Second page student', exact: true }).count(), 1)
   assert.equal(await page.getByRole('heading', { name: 'First page student', exact: true }).count(), 0)
   assert.equal(await page.getByText('Page 2 of 2', { exact: true }).count(), 1)
  } finally { releaseReview(); await page.unroute('**/api/admin/student-applications**', handler) }
 })
 await check('A conflicting Student decision reload closes the stale review form', async () => {
  const initial = { id: '33333333-3333-4333-8333-333333333333', institution: 'Concurrent review student', status: 'pending', institution_email: null, email_verified_at: null, eligible_until: null, evidence_available: true, evidence_cleanup_pending: false, review_note: null }
  let decided = false
  const handler = async route => {
   if (route.request().method() === 'POST') {
    decided = true
    return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Another reviewer already decided this application.' }) })
   }
   return route.fulfill({ contentType: 'application/json', body: JSON.stringify(rows([{ ...initial, status: decided ? 'approved' : 'pending', evidence_available: !decided, review_note: decided ? 'Current registration confirmed by another reviewer.' : null }])) })
  }
  await page.route('**/api/admin/student-applications**', handler)
  try {
   await page.goto(origin + '/admin/manage/student-applications')
   await page.getByRole('button', { name: 'Review application', exact: true }).click()
   const note = page.getByLabel('Decision reason (shown to the student)', { exact: true })
   await note.fill('Please provide a newer registration record.')
   await page.getByRole('button', { name: 'Reject and delete evidence', exact: true }).click()
   await page.getByRole('button', { name: 'Retry applications', exact: true }).click()
   await page.getByText('Current registration confirmed by another reviewer.', { exact: false }).waitFor()
   assert.equal(await page.getByLabel('Decision reason (shown to the student)', { exact: true }).count(), 0)
   assert.equal(await page.getByRole('button', { name: 'Review application', exact: true }).count(), 0)
   assert.equal(await page.getByRole('link', { name: 'Download private enrolment evidence', exact: true }).count(), 0)
  } finally { await page.unroute('**/api/admin/student-applications**', handler) }
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
 await check('Student domains require attestation and recover from stale admin changes', async () => {
  await page.goto(origin + '/admin/manage/student-applications')
  await page.getByText('No exception or blocked domains. Institutional .edu.ng email verification remains available.', { exact: true }).waitFor()
  await page.getByLabel('Nigerian academic domain', { exact: true }).fill('students.synthetic.example')
  await page.getByLabel('Institution name', { exact: true }).fill('Synthetic College')
  const approve = page.getByRole('button', { name: 'Save domain policy', exact: true })
  assert.equal(await approve.isDisabled(), true)
  await page.getByLabel('I confirmed Nigerian tertiary status and ownership of this email domain. Mailbox ownership does not prove current enrollment.', { exact: true }).check()
  await approve.click()
  await page.getByText('Nigerian tertiary domain approved. Verified ownership is still required.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Disable students.synthetic.example', exact: true }).waitFor()
  studentDomains[0].version += 1
  await page.getByRole('button', { name: 'Disable students.synthetic.example', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh student domains', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Refresh student domains', exact: true }).click()
  await page.getByRole('button', { name: 'Disable students.synthetic.example', exact: true }).click()
  await page.getByRole('button', { name: 'Enable students.synthetic.example', exact: true }).waitFor()
  await page.setViewportSize({ width: 320, height: 800 })
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  await page.getByRole('heading', { name: 'Approved student email domains', exact: true }).scrollIntoViewIfNeeded()
  const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > window.innerWidth + 1).map(element => ({ tag: element.tagName, text: element.textContent?.slice(0, 65), width: element.getBoundingClientRect().width, class: element.className })).slice(-12))
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, JSON.stringify(overflow))
  await page.evaluate(() => { document.documentElement.style.fontSize = '' })
  await page.setViewportSize({ width: 1440, height: 1000 })
 })
 assert.deepEqual(errors, [])
} finally {
 await browser?.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
 await app.close(); backend.closeAllConnections(); await new Promise(resolve => backend.close(resolve))
}
process.exit(failures ? 1 : 0)
