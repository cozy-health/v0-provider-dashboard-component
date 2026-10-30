// Isolated contract fixtures. Never connects to the deployed API or real patients.
import assert from 'node:assert/strict'
import { reviewThemes } from './theme-design-review.mjs'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { createIsolatedTestApp } from './isolated-next-app.mjs'
import { pathToFileURL } from 'node:url'
import { sealSession, SESSION_COOKIE } from '../lib/provider-session.ts'

const calls = []
const provider = { id: 1, name: 'Test Provider', email: 'provider@example.test', practice: 'Test Practice', timezone: 'UTC', is_verified: true }
let consent = { moods: true, journals: true, quizzes: true, notes: true }
let linked = true
let available = true
let signedPath = '/api/v1/provider/reports/1/file?expires=9999999999&signature=test-signature'
let resources = []
let assignments = []
let notes = []
let reports = []
let rosterEmpty = false
let populatedHistory = false
let quizShareActive = true
let quizShareRead = false
let documentConfig = { enforce_blocking: false, documents: {
  tos: { title: 'Provider Terms of Service', version: 'draft-0.1', published: false, required: true, content: null },
  privacy_policy: { title: 'Provider Privacy Policy', version: 'draft-0.1', published: false, required: true, content: null },
} }
let documentConsents = []
const client = () => ({ user_id: 10, name: 'Test', linked_at: '2026-10-01T10:00:00Z', consent_flags: consent })
const backend = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  const paginated = data => { const page = Number(url.searchParams.get('page') || 1); const size = Number(url.searchParams.get('per_page') || 20); return { data: data.slice((page - 1) * size, page * size), current_page: page, last_page: Math.max(1, Math.ceil(data.length / size)), total: data.length } }
  const path = url.pathname.replace('/api/v1/provider/', '')
  const chunks = []; for await (const chunk of request) chunks.push(chunk)
  const body = Buffer.concat(chunks).toString()
  calls.push({ path, query: url.search, method: request.method, auth: request.headers.authorization, body: body ? JSON.parse(body) : null })
  response.setHeader('Content-Type', 'application/json')
  function send(data, status = 200) { response.writeHead(status); response.end(JSON.stringify(data)) }
  if (!available) return send({ message: 'Internal secret must not leak' }, 500)
  if (path === 'auth/register') {
    return send({ message: 'Enter complete provider registration details.', errors: { name: ['A provider name is required.'] } }, 422)
  }
  if (path === 'auth/login') {
    if (JSON.parse(body).password !== 'test-password') return send({ message: 'Credentials incorrect.', errors: { email: ['Credentials incorrect.'] } }, 422)
    return send({ data: { provider, token: 'test-bearer-secret' } })
  }
  if (path === 'auth/forgot-password' || path === 'auth/reset-password') return send({ message: 'Reset request accepted.' })
  if (request.headers.authorization !== 'Bearer test-bearer-secret') return send({ message: 'Unauthorized' }, 401)
  if (path === 'auth/logout') return send({ message: 'Signed out' })
  if (path === 'consent-config') return send({ consent: documentConfig })
  if (path === 'me/consents') {
    if (request.method === 'POST') {
      const data = JSON.parse(body)
      assert.equal(data.actor_id, provider.id)
      const record = { ...data, status: data.pre_acceptance ? 'pre_acceptance' : 'accepted' }
      documentConsents = [...documentConsents.filter(row => row.document_type !== data.document_type || row.version !== data.version), record]
      return send({ owner_id: provider.id, data: record })
    }
    return send({ owner_id: provider.id, data: documentConsents })
  }
  if (path === 'me') { if (request.method === 'PATCH') Object.assign(provider, JSON.parse(body)); return send({ data: { provider } }) }
  if (path === 'clients') return send(rosterEmpty ? [] : [client()])
  if (path === 'quiz-shares') return send(paginated(linked && consent.quizzes && quizShareActive ? [{ id: 1, user_id: 10, sender: 'Test', quiz_title: 'Fixture shared assessment', completed_at: '2026-10-09T10:00:00Z', read_at: quizShareRead ? '2026-10-10T10:00:00Z' : null }] : []))
  if (path === 'quiz-shares/1') {
    if (!linked || !consent.quizzes || !quizShareActive) return send({ message: 'This shared result is unavailable.' }, 404)
    quizShareRead = true
    return send({ id: 'q1', quiz_slug: 'fixture', quiz_title: 'Fixture shared assessment', score: 4, maximum_score: 27, interpretation: 'Fixture interpretation', completed_at: '2026-10-09T10:00:00Z', disclaimer: 'Fixture disclaimer.', recommendation: 'Fixture recommendation.' })
  }
  if (path.startsWith('clients/10') && !linked) return send({ message: 'No link' }, 404)
  if (path === 'clients/10') return send(client())
  if (path === 'clients/10/moods') return consent.moods ? send(paginated([{ id: 'm1', mood: 'anxious', intensity: 4, triggers: ['work'], custom_trigger: null, coping_strategies: ['breathing'], coping_helped: 'no', created_at: '2026-10-09T10:00:00Z' }])) : send({}, 404)
  if (path === 'clients/10/journals') return consent.journals ? send(paginated(populatedHistory ? [{ id: 'j1', title: 'Shared summary fixture', type: 'text', word_count: 42, has_voice: true, created_at: '2026-10-09T10:00:00Z' }] : [])) : send({}, 404)
  if (path === 'clients/10/quizzes') return consent.quizzes ? send(paginated(populatedHistory ? [{ id: 'q1', quiz_slug: 'phq-9', score: 4, interpretation: 'Fixture interpretation', completed_at: '2026-10-09T10:00:00Z' }] : [])) : send({}, 404)
  if (path.startsWith('clients/10/notes')) {
    if (!consent.notes) return send({}, 404)
    if (request.method === 'POST') { const note = { id: notes.length + 1, ...JSON.parse(body), created_at: new Date().toISOString() }; notes.unshift(note); return send({ note }, 201) }
    if (request.method === 'DELETE') { notes = notes.filter(note => note.id !== Number(path.split('/').at(-1))); return send({}) }
    return send(paginated(notes))
  }
  if (path.startsWith('clients/10/resources')) {
    if (request.method === 'POST') { const payload = JSON.parse(body); const assignment = { id: assignments.length + 1, resource: resources.find(resource => resource.id === payload.resource_id), notes: payload.notes, status: 'assigned', assigned_at: new Date().toISOString() }; assignments.unshift(assignment); return send({ assignment }, 201) }
    if (request.method === 'DELETE') { assignments = assignments.filter(item => item.id !== Number(path.split('/').at(-1))); return send({}) }
    return send(paginated(assignments))
  }
  if (/^resources(\/\d+)?$/.test(path)) {
    if (request.method === 'POST') { const resource = { id: resources.length + 1, ...JSON.parse(body) }; resources.unshift(resource); return send({ resource }, 201) }
    if (request.method === 'PATCH') { const resource = resources.find(resource => resource.id === Number(path.split('/')[1])); Object.assign(resource, JSON.parse(body)); return send({ resource }) }
    if (request.method === 'DELETE') { resources = resources.filter(resource => resource.id !== Number(path.split('/')[1])); return send({}) }
    return send(paginated(resources))
  }
  if (path === 'reports') {
    if (request.method === 'POST') { const report = { id: 1, user_id: 10, period_start: '2026-10-01', period_end: '2026-10-09', generated_at: new Date().toISOString() }; reports = [report]; return send({ report }, 201) }
    return send(paginated(reports))
  }
  if (path === 'reports/1/download') return linked ? send({ download_url: signedPath }) : send({}, 404)
  if (path === 'reports/1/file') { response.setHeader('Content-Type', 'application/pdf'); response.end('%PDF-1.4\nTest report'); return }
  if (path === 'access-log') return send(paginated(calls.filter(call => call.path.startsWith('clients')).map((call, i) => ({ id: i + 1, user_id: 10, action: call.method === 'GET' ? 'list' : 'create', resource_type: 'client', created_at: new Date().toISOString() }))))
  return send({}, 404)
})

await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve))
const backendPort = backend.address().port
process.env.NODE_ENV = 'development'
process.env.PROVIDER_API_URL = `http://127.0.0.1:${backendPort}/api/v1/provider/`
process.env.PROVIDER_SESSION_SECRET = randomBytes(32).toString('hex')
const app = await createIsolatedTestApp('provider-contract')
let server, browser
const sockets = new Set()
let exitCode = 0
try {
  await app.prepare()
  server = createServer(app.getRequestHandler())
  server.on('upgrade', app.getUpgradeHandler())
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  process.env.PROVIDER_DASHBOARD_ORIGIN = origin
  const csrfResponse = await fetch(`${origin}/api/csrf`)
  const csrfCookie = csrfResponse.headers.get('set-cookie').split(';')[0]
  const csrf = (await csrfResponse.json()).token
  let cookie = ''
  const request = (path, method = 'GET', payload, headers = {}) => fetch(`${origin}/api/provider/${path}`, { method, headers: { Cookie: `${cookie}; ${csrfCookie}`, Origin: origin, 'X-Cozy-Request': '1', 'X-CSRF-Token': csrf, 'Content-Type': 'application/json', ...headers }, body: payload === undefined ? undefined : JSON.stringify(payload), redirect: 'manual' })
  const login = () => request('auth/login', 'POST', { email: provider.email, password: 'test-password', device_name: 'ignored' })
  assert.equal((await fetch(origin, { redirect: 'manual' })).status, 307)
  assert.equal((await request('clients')).status, 401)
  const initialCalls = calls.length
  assert.equal((await request('auth/login', 'POST', {}, { Origin: 'https://evil.test' })).status, 403)
  assert.equal((await request('auth/login', 'POST', {}, { 'X-Cozy-Request': '' })).status, 403)
  assert.equal(calls.length, initialCalls)
  assert.equal((await request('auth/login', 'POST', { email: provider.email, password: 'wrong' })).status, 422)
  const signedIn = await login()
  assert.equal(signedIn.status, 200)
  const loginData = await signedIn.text()
  assert.ok(!loginData.includes('test-bearer-secret'))
  const setCookie = signedIn.headers.get('set-cookie')
  assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=lax/i); assert.match(setCookie, /Max-Age=1800/i)
  cookie = setCookie.split(';')[0]
  assert.equal(calls.at(-1).body.device_name, 'cozy-provider-dashboard')
  assert.equal((await request('clients')).status, 200)
  assert.equal((await request('quiz-shares')).status, 200)
  const sharedSummary = await (await request('quiz-shares/1')).json()
  assert.equal(sharedSummary.score, 4); assert.ok(!('answers' in sharedSummary))
  quizShareActive = false; assert.equal((await request('quiz-shares/1')).status, 404); quizShareActive = true
  assert.equal((await request('me', 'PATCH', { name: 'Updated Provider' })).status, 200)
  assert.equal((await request('auth/forgot-password', 'POST', { email: provider.email })).status, 200)
  assert.equal((await request('auth/register', 'POST', {})).status, 422)
  assert.equal(calls.at(-1).path, 'auth/register')
  const beforeBlocked = calls.length
  assert.equal((await request('clients/10/moods', 'POST', {})).status, 404)
  assert.equal((await request('me', 'PATCH', {}, { Origin: 'https://evil.test' })).status, 403)
  assert.equal((await request('resources', 'POST', { title: 'x'.repeat(66000) })).status, 413)
  assert.equal(calls.length, beforeBlocked)
  const pdf = await request('reports/1/pdf')
  assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf'); assert.match(await pdf.text(), /^%PDF/)
  assert.equal(calls.at(-1).query, '?expires=9999999999&signature=test-signature')
  assert.equal(calls.at(-1).auth, 'Bearer test-bearer-secret')
  signedPath = 'https://evil.test/api/v1/provider/reports/1/file'
  assert.equal((await request('reports/1/pdf')).status, 502)
  signedPath = '/api/v1/provider/reports/1/file?expires=9999999999&signature=test-signature'
  linked = false; assert.equal((await request('reports/1/pdf')).status, 404); linked = true
  available = false; const unavailable = await request('clients'); assert.equal(unavailable.status, 500); assert.ok(!(await unavailable.text()).includes('Internal secret')); available = true
  const validCookie = cookie
  cookie = `${SESSION_COOKIE}=${sealSession({ token: 'test-bearer-secret', expires: Date.now() - 1000 })}`
  assert.equal((await request('clients')).status, 401)
  cookie = `${SESSION_COOKIE}=${sealSession({ token: 'revoked-token', expires: Date.now() + 60000 })}`
  const revoked = await request('clients'); assert.equal(revoked.status, 401); assert.match(revoked.headers.get('set-cookie'), /Max-Age=0/)
  cookie = validCookie
  assert.equal((await request('auth/logout', 'POST', {})).status, 200)
  assert.equal(calls.at(-1).path, 'auth/logout')
  console.log('PASS: HTTP bridge, auth, CSRF, allowlist, payload bounds, expiry, backend errors, signed PDF and logout checks')

  const playwright = process.env.PROVIDER_PLAYWRIGHT_PATH ? await import(pathToFileURL(process.env.PROVIDER_PLAYWRIGHT_PATH).href) : null
  if (playwright) {
    browser = await playwright.chromium.launch({ headless: true, ...(process.env.PROVIDER_CHROMIUM_PATH ? { executablePath: process.env.PROVIDER_CHROMIUM_PATH } : {}) })
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    // Keep development hot-reload traffic out of the HTTP portal contract test.
    await context.routeWebSocket("**/_next/webpack-hmr**", () => {})
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => dialog.accept())
    await page.goto(origin)
    await page.waitForFunction(() => {
      const button = document.querySelector('button[type="submit"]')
      return button && !button.disabled
    })
    await page.getByLabel('Email', { exact: true }).fill(provider.email)
    await page.getByLabel('Password', { exact: true }).fill('test-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByRole('button', { name: 'View patient' }).waitFor()
    await page.goto(origin)
    await page.getByRole('button', { name: 'View patient' }).waitFor()
    await reviewThemes(page, 'provider-root')
    await page.goto(`${origin}/provider`)
    await page.getByRole('button', { name: 'View patient' }).waitFor()
    await reviewThemes(page, 'provider-alias')
    assert.equal(new URL(page.url()).pathname, '/provider')
    assert.equal(await page.locator('a[href^="/admin"]').count(), 0)
    await page.getByRole('button', { name: 'Shared assessment results', exact: true }).click()
    await page.getByText('Test shared Fixture shared assessment').waitFor()
    await page.getByRole('button', { name: 'View result', exact: true }).click()
    await page.getByText('Score: 4 / 27', { exact: true }).waitFor()
    await page.getByText('Fixture recommendation.', { exact: true }).waitFor()
    quizShareActive = false
    await page.getByRole('button', { name: 'Refresh shared results', exact: true }).click()
    await page.getByText('No results have been shared with you yet.').waitFor()
    assert.equal(await page.getByText('Score: 4 / 27', { exact: true }).count(), 0)
    quizShareActive = true
    await page.getByRole('button', { name: 'Patients', exact: true }).click()
    await page.getByLabel('Search patients').fill('missing-patient')
    await page.getByText('No patients match your search.').waitFor()
    await page.getByLabel('Search patients').fill('10')
    await page.getByRole('button', { name: 'View patient' }).waitFor()
    await page.getByLabel('Search patients').fill('')
    const scope = (await context.cookies()).find(cookie => cookie.name === 'cozy-provider-scope')?.value
    const credential = (await context.cookies()).find(cookie => cookie.name === (scope ? `cozy-provider.${scope}` : SESSION_COOKIE))
    assert.ok(credential?.httpOnly)
    const visibleCookies = await page.evaluate(() => document.cookie)
    assert.ok(!visibleCookies.includes(credential.name + '='))
    assert.ok(!visibleCookies.includes('test-bearer-secret'))
    await page.getByRole('button', { name: 'Resources', exact: true }).click()
    await page.getByText('Build your resource library', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Add resource' }).click()
    await page.getByLabel('Title', { exact: true }).fill('Test breathing resource')
    await page.getByLabel('Description', { exact: true }).fill('Test instructions')
    await page.getByRole('button', { name: 'Save resource' }).click()
    await page.getByRole('heading', { name: 'Test breathing resource' }).waitFor()
    assert.equal(resources.length, 1)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Title', { exact: true }).fill('Updated breathing resource')
    await page.getByRole('button', { name: 'Save resource' }).click()
    await page.getByRole('heading', { name: 'Updated breathing resource' }).waitFor()
    assert.equal(resources[0].title, 'Updated breathing resource')
    await page.getByRole('button', { name: 'Reports', exact: true }).click()
    await page.getByText('No reports generated yet.', { exact: false }).waitFor()
    await page.getByRole('button', { name: 'Patients', exact: true }).click()
    await page.getByRole('button', { name: 'View patient' }).click()
    await page.getByText('Intensity 4/10', { exact: false }).waitFor()
    await page.getByText('Feedback: no', { exact: false }).waitFor()
    assert.equal(await page.locator('.recharts-bar-rectangle path').count(), 2)
    await page.getByText('No shared journal entries yet.').waitFor()
    await page.getByText('No shared assessment results yet.').waitFor()
    populatedHistory = true
    await page.getByRole('button', { name: 'Refresh sharing' }).click()
    await page.getByRole('heading', { name: 'Shared summary fixture' }).waitFor()
    await page.getByText('Score: 4', { exact: false }).waitFor()
    await page.getByText('42 words', { exact: false }).waitFor()
    await page.screenshot({ path: '../docs/PD5_PATIENT_LIGHT.png', fullPage: true })
    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    assert.equal(await page.locator('html').getAttribute('class'), 'dark')
    await page.screenshot({ path: '../docs/PD5_PATIENT_DARK.png', fullPage: true })
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await page.getByRole('tab', { name: 'Provider notes' }).click()
    await page.getByText('No provider notes yet.').waitFor()
    await page.getByLabel('New provider note').fill('Persistent test note')
    const savedNote = page.waitForResponse(response => response.url().endsWith('/api/provider/clients/10/notes') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Save note' }).click()
    assert.equal((await savedNote).status(), 201)
    await page.getByText('Persistent test note', { exact: true }).waitFor()
    assert.equal(notes[0].body, 'Persistent test note')
    await page.getByLabel('New provider note').fill('Unsaved draft survives revalidation')
    const previousCalls = calls.length
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.waitForFunction(() => document.querySelector('#provider-note')?.value === 'Unsaved draft survives revalidation')
    await new Promise(resolve => setTimeout(resolve, 200))
    assert.ok(calls.slice(previousCalls).some(call => call.path === 'clients/10'))
    assert.equal(await page.getByLabel('New provider note').inputValue(), 'Unsaved draft survives revalidation')
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByText('No provider notes yet.').waitFor()
    assert.equal(notes.length, 0)
    await page.getByRole('tab', { name: 'Resources', exact: true }).click()
    await page.getByText('No resources assigned to this patient yet.').waitFor()
    await page.getByRole('button', { name: 'Select', exact: true }).click()
    await page.getByLabel('Patient guidance (optional)').fill('Practice daily')
    await page.getByRole('button', { name: 'Assign selected resource' }).click()
    await page.getByText('assigned', { exact: true }).waitFor()
    assert.equal(assignments.length, 1)
    await page.getByRole('button', { name: 'Remove assignment', exact: true }).click()
    await page.getByText('No resources assigned to this patient yet.').waitFor()
    assert.equal(assignments.length, 0)
    await page.getByRole('button', { name: 'Generate monthly report' }).click()
    await page.getByRole('button', { name: 'Download PDF' }).waitFor()
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download PDF' }).click()
    assert.equal((await downloaded).suggestedFilename(), 'provider-report-1.pdf')
    consent = { moods: false, journals: false, quizzes: false, notes: false }
    const callsBefore = calls.length
    await page.getByRole('button', { name: 'Refresh sharing' }).click()
    await page.getByText('This patient has not shared any data types.', { exact: false }).waitFor()
    assert.equal(await page.getByRole('tab', { name: 'Provider notes' }).count(), 0)
    assert.equal(await page.getByText('Persistent test note', { exact: true }).count(), 0)
    assert.equal(calls.slice(callsBefore).filter(call => /clients\/10\/(moods|journals|quizzes|notes)$/.test(call.path)).length, 0)
    await page.getByRole('button', { name: 'Audit log', exact: true }).click()
    await page.getByText('Patient #10', { exact: false }).first().waitFor()
    await page.getByLabel('Action', { exact: true }).fill('list')
    const filteredAudit = page.waitForResponse(response => response.url().includes('/api/provider/access-log?action=list'))
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click()
    assert.equal((await filteredAudit).status(), 200)
    await page.getByRole('button', { name: 'Clear', exact: true }).click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Saved Provider')
    await page.getByLabel('Practice', { exact: true }).fill('Updated Test Practice')
    await page.getByLabel('Timezone', { exact: true }).fill('Africa/Lagos')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await page.getByText('Saved Provider', { exact: true }).waitFor()
    assert.equal(provider.name, 'Saved Provider')
    assert.equal(provider.practice, 'Updated Test Practice')
    assert.equal(provider.timezone, 'Africa/Lagos')
    for (let id = 2; id <= 22; id++) resources.push({ id, title: `Page resource ${id}`, type: 'article', description: null, url: null, duration_minutes: null })
    await page.getByRole('button', { name: 'Resources', exact: true }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('heading', { name: 'Page resource 22' }).waitFor()
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await page.getByRole('heading', { name: 'Updated breathing resource' }).waitFor()
    assert.equal(resources.length, 21)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Patients', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'View patient' }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    await page.screenshot({ path: '../docs/PD5_MOBILE_VIEW.png', fullPage: true })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.getByRole('button', { name: 'View patient' }).click()
    await page.getByText('This patient has not shared any data types.', { exact: false }).waitFor()
    await page.screenshot({ path: '../docs/PD5_CONSENT_VIEW.png', fullPage: true })
    linked = false
    await page.getByRole('button', { name: 'Refresh sharing' }).click()
    await page.getByText('This data is unavailable or access has changed.').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Generate monthly report' }).count(), 0)
    linked = true; rosterEmpty = true
    await page.getByRole('button', { name: 'Patients', exact: true }).click()
    await page.getByText('No linked patients yet.', { exact: false }).waitFor()
    assert.equal(documentConsents.filter(record => record.status === 'pre_acceptance').length, 2)
    documentConfig.documents.tos.version = 'draft-0.2'
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await page.getByRole('button', { name: 'Review', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Review', exact: true }).click()
    await page.getByText('This document is still a draft.', { exact: false }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Accept', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click()
    documentConfig = { enforce_blocking: true, documents: Object.fromEntries(Object.entries(documentConfig.documents).map(([type, doc]) => [type, { ...doc, version: '1.0', published: true, content: `Approved ${type} fixture.` }])) }
    documentConsents.push({ document_type: 'privacy_policy', version: '1.0', status: 'accepted' })
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await page.getByRole('dialog', { name: 'Provider Terms of Service' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Dismiss', exact: true }).count(), 0)
    const consentSaved = page.waitForResponse(response => response.url().endsWith('/api/provider/me/consents') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Accept', exact: true }).click()
    assert.equal((await consentSaved).status(), 200)
    await page.getByRole('dialog', { name: 'Provider Terms of Service' }).waitFor({ state: 'detached' })
    console.log('PASS provider document consent: silent draft tracking, skippable draft review, published blocking flag and explicit acceptance')
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByRole('heading', { name: 'Provider sign in' }).waitFor()
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await page.getByLabel('Email', { exact: true }).fill(provider.email)
    await page.getByRole('button', { name: 'Send reset code' }).click()
    await page.getByLabel('Six-digit code').fill('123456')
    await page.getByLabel('New password', { exact: true }).fill('new-test-password')
    await page.getByLabel('Confirm password', { exact: true }).fill('new-test-password')
    await page.getByRole('button', { name: 'Reset password', exact: true }).click()
    await page.getByRole('heading', { name: 'Provider sign in' }).waitFor()
    assert.equal(calls.at(-1).path, 'auth/reset-password')
    assert.deepEqual(errors, [])
    console.log('PASS: browser login, resource CRUD, authorized patient data, notes, assignment, PDF, consent withdrawal, settings, audit, narrow viewport, revocation, empty roster and logout')
  } else console.log('Browser checks skipped: set PROVIDER_PLAYWRIGHT_PATH to an installed Playwright module.')
} catch (error) {
  exitCode = 1
  console.error(error)
  const page = browser?.contexts()[0]?.pages()[0]
  if (page) { console.error('Browser failure state:', await page.locator('body').innerText()); await page.screenshot({ path: '../docs/PD5_FAILURE.png', fullPage: true }) }
} finally {
  await browser?.close()
  for (const socket of sockets) socket.destroy()
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  // Next's development watchers can keep a custom server alive after sockets close.
  await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 5000))])
  backend.closeAllConnections(); await new Promise(resolve => backend.close(resolve))
}
process.exit(exitCode)

