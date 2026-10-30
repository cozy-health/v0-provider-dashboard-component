import { reviewThemes } from './theme-design-review.mjs'
// Local contract fixtures only: no deployed API, email delivery, or patient records.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { createIsolatedTestApp } from './isolated-next-app.mjs'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'

const provider = { id: 1, name: 'Avery Taylor', email: 'avery@example.test', practice: null, is_verified: false }
const flags = { moods: true, journals: false, quizzes: false, notes: true }
let patients = [], changed = false, codeUsed = false, registrations = 0, confirmations = 0
const calls = []
const backend = createServer(async (request, response) => {
 const path = new URL(request.url, 'http://localhost').pathname.replace('/api/v1/provider/', '')
 const chunks = []; for await (const chunk of request) chunks.push(chunk)
 const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}
 calls.push({ path, body, auth: request.headers.authorization })
 const send = (data, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(data)) }
 if (path === 'auth/register') {
  registrations++
  assert.deepEqual(Object.keys(body).sort(), ['name', 'email', 'password', 'password_confirmation', 'practice'].sort())
  assert.equal(body.name, provider.name); assert.equal(body.email, provider.email)
  assert.equal(body.practice, null); assert.equal(body.password, body.password_confirmation)
  return send({ data: { provider, token: 'fixture-provider-token', refresh_token: 'fixture-refresh-secret' } }, 201)
 }
 if (request.headers.authorization !== 'Bearer fixture-provider-token') return send({ message: 'Unauthenticated.' }, 401)
 if (path === 'me') return send({ data: { provider } })
 if (path === 'consent-config') return send({ consent: { enforce_blocking: false, documents: {} } })
 if (path === 'me/consents') return send({ owner_id: 1, data: [] })
 if (path === 'clients') return send(patients)
 if (path === 'invitations/preview') {
  if (body.code !== '123456' || codeUsed) return send({ message: 'This code is invalid, expired, or no longer available.' }, 422)
  return send({ data: { invitation_id: 42, patient_name: 'Taylor', consent_flags: changed ? { ...flags, moods: false } : flags, expires_at: new Date(Date.now() + 900000).toISOString() } })
 }
 if (path === 'invitations/connect') {
  assert.equal(body.code, '123456'); assert.equal(body.invitation_id, 42)
  assert.equal(body.care_acknowledged, true); assert.equal(body.revocation_acknowledged, true)
  if (changed && body.consent_flags.moods) return send({ message: 'The patient changed their sharing choices. Review the invitation again.' }, 409)
  confirmations++; codeUsed = true
  const scope = changed ? { ...flags, moods: false } : flags
  assert.deepEqual(body.consent_flags, scope)
  patients = [{ user_id: 10, name: 'Taylor', linked_at: new Date().toISOString(), consent_flags: scope }]
  return send({ message: 'Patient connected.', data: { user_id: 10 } })
 }
 return send({ message: 'Unavailable.' }, 404)
})
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve))
process.env.NODE_ENV = 'development'
process.env.PROVIDER_API_URL = `http://127.0.0.1:${backend.address().port}/api/v1/provider/`
process.env.PROVIDER_SESSION_SECRET = randomBytes(32).toString('hex')
const app = await createIsolatedTestApp('provider-onboarding')
let server, browser, exitCode = 0
try {
 await app.prepare()
 server = createServer(app.getRequestHandler()); server.on('upgrade', app.getUpgradeHandler())
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 const origin = `http://127.0.0.1:${server.address().port}`; process.env.PROVIDER_DASHBOARD_ORIGIN = origin
 const playwright = await import(pathToFileURL(process.env.PROVIDER_PLAYWRIGHT_PATH).href)
 browser = await playwright.chromium.launch({ headless: true })
 const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
 await context.routeWebSocket('**/_next/webpack-hmr**', () => {})
 let registrationBody = ''
 const page = await context.newPage(), errors = []
 // Route assertions include cold development compilation on CI.
 page.setDefaultNavigationTimeout(120000)
 page.setDefaultTimeout(120000)
 await page.route('**/api/provider/auth/register', async route => {
  const upstream = await route.fetch()
  registrationBody = await upstream.text()
  await route.fulfill({ response: upstream, body: registrationBody })
 })
 page.on('pageerror', error => errors.push(error.message))
 await page.goto(`${origin}/provider`)
 await page.getByRole('link', { name: 'Create provider account', exact: true }).click()
 await page.getByRole('heading', { name: 'Create provider account', exact: true }).waitFor()
 await reviewThemes(page, 'provider-register')
 assert.equal(await page.locator('a[href^="/admin"]').count(), 0)
 await page.getByLabel('First name', { exact: true }).fill('Avery')
 await page.getByLabel('Last name', { exact: true }).fill('Taylor')
 await page.getByLabel('Email', { exact: true }).fill('AVERY@example.test')
 await page.getByLabel('Password', { exact: true }).fill('FixturePassword123')
 await page.getByLabel('Confirm password', { exact: true }).fill('DifferentPassword123')
 await page.getByRole('button', { name: 'Create account', exact: true }).click()
 await page.getByRole('alert').getByText('Passwords must match.').waitFor()
 assert.equal(registrations, 0)
 await mkdir('../docs/validation/provider-onboarding', { recursive: true })
 for (const [theme, background] of [['dark', 'rgb(0, 0, 0)'], ['light', 'rgb(248, 250, 252)']]) {
  await page.emulateMedia({ colorScheme: theme })
  await page.waitForFunction(dark => document.documentElement.classList.contains('dark') === dark, theme === 'dark')
  assert.equal(await page.locator('main').evaluate(el => getComputedStyle(el).backgroundColor), background)
  await page.screenshot({ path: `../docs/validation/provider-onboarding/registration-${theme}.png`, fullPage: true })
 }
 await page.screenshot({ path: '../docs/validation/provider-onboarding/registration.png', fullPage: true })
 await page.getByLabel('Confirm password', { exact: true }).fill('FixturePassword123')
 const registered = page.waitForResponse(r => r.url().endsWith('/api/provider/auth/register'))
 await page.getByRole('button', { name: 'Create account', exact: true }).click()
 const response = await registered; assert.equal(response.status(), 201)
 assert.ok(!registrationBody.includes('fixture-provider-token')); assert.ok(!registrationBody.includes('fixture-refresh-secret'))
 await page.getByText(/No linked patients yet/).waitFor()
 assert.equal(registrations, 1)
 const currentScope = (await context.cookies()).find(cookie => cookie.name === 'cozy-provider-scope')?.value
 assert.ok(currentScope)
 assert.ok((await context.cookies()).find(cookie => cookie.name === 'cozy-provider.' + currentScope)?.httpOnly)
 assert.ok(!(await page.evaluate(() => document.cookie)).includes('fixture-provider-token'))
 assert.ok(!(await page.evaluate(() => document.cookie)).includes('cozy-provider.' + currentScope + '='))
 await reviewThemes(page, 'provider-empty')
 await page.screenshot({ path: '../docs/validation/provider-onboarding/empty-roster.png', fullPage: true })
 await page.getByRole('button', { name: 'Accept patient invitation', exact: true }).click()
 await page.getByLabel('Patient connection code').fill('000000')
 await page.getByRole('button', { name: 'Review invitation' }).click()
 await page.getByRole('alert').getByText(/invalid, expired/).waitFor()
 await page.getByLabel('Patient connection code').fill('123456')
 await page.getByRole('button', { name: 'Review invitation' }).click()
 await page.getByRole('heading', { name: 'Review patient sharing' }).waitFor()
 assert.equal(await page.getByRole('button', { name: 'Agree & connect' }).isDisabled(), true)
 assert.equal(confirmations, 0)
 await page.screenshot({ path: '../docs/validation/provider-onboarding/review.png', fullPage: true })
 await page.getByRole('checkbox').nth(0).check(); await page.getByRole('checkbox').nth(1).check()
 changed = true
 await page.getByRole('button', { name: 'Agree & connect' }).click()
 await page.getByRole('alert').getByText(/changed their sharing/).waitFor()
 assert.equal(confirmations, 0)
 await page.getByRole('button', { name: 'Review invitation' }).click()
 await page.getByRole('heading', { name: 'Review patient sharing' }).waitFor()
 await page.getByRole('checkbox').nth(0).check(); await page.getByRole('checkbox').nth(1).check()
 await page.getByRole('button', { name: 'Agree & connect' }).click()
 await page.getByRole('button', { name: 'View patient', exact: true }).waitFor()
 await reviewThemes(page, 'provider-populated')
 assert.equal(confirmations, 1)
 await page.setViewportSize({ width: 390, height: 844 })
 await page.getByRole('button', { name: 'Accept patient invitation', exact: true }).click()
 await page.getByLabel('Patient connection code').fill('123456')
 await page.getByRole('button', { name: 'Review invitation' }).click()
 await page.getByRole('alert').getByText(/invalid, expired/).waitFor()
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
 await page.emulateMedia({ colorScheme: 'dark' })
 await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
 await page.waitForFunction(() => getComputedStyle(document.querySelector('[role="dialog"]')).backgroundColor === 'rgb(0, 0, 0)')
 assert.equal(await page.getByRole('dialog').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)')
 await page.screenshot({ path: '../docs/validation/provider-onboarding/connection-mobile-dark.png', fullPage: true })
 assert.deepEqual(errors, [])
 console.log('PASS provider onboarding: independent registration, secure cookie, empty roster, invitation preview, acknowledgements, changed consent, connection, replay error, mobile layout, and no runtime errors.')
} catch (error) { exitCode = 1; console.error(error) } finally {
 await browser?.close()
 if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
 await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 5000))])
 backend.closeAllConnections(); await new Promise(resolve => backend.close(resolve))
}
process.exit(exitCode)
