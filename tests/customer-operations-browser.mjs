import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sealAdmin } from '../lib/admin-session.ts'

// Browser+real Next bridge acceptance; the backend is an isolated contract fixture.
if (!process.env.ADMIN_PLAYWRIGHT_PATH) throw new Error('Set ADMIN_PLAYWRIGHT_PATH to the installed Playwright module entry point, as for the other admin browser tests.')
const { chromium } = await import(pathToFileURL(resolve(process.env.ADMIN_PLAYWRIGHT_PATH)).href)
const output = resolve('../output/first-three-browser'); mkdirSync(output, { recursive: true }); mkdirSync('scratch', { recursive: true })
const fixtureName = `customer-operations-${Array.from(randomBytes(6), value => String.fromCharCode(97 + value % 26)).join('')}`
writeFileSync(`scratch/tsconfig-${fixtureName}.json`, JSON.stringify({ extends: '../tsconfig.json', compilerOptions: { strict: true, noUncheckedIndexedAccess: true }, include: ['../next-env.d.ts', '../**/*.ts', '../**/*.tsx'], exclude: ['../node_modules', '../scratch', '../.next*'] }, null, 2))
const key = randomBytes(32).toString('hex'); process.env.ADMIN_SESSION_SECRET = key
let capabilities = ['admin:metrics', 'admin:support', 'admin:privacy'], supportVersion = 0, privacyVersion = 1
let note = 'Existing private staff note', status = 'open', replies = [], replyConflict = false, privacyConflict = false
const replyIds = [], decisions = []
const privacyId = '12345678-1234-4234-8234-123456789abc', messageId = '22345678-1234-4234-8234-123456789abc'
const privacy = () => ({ id: privacyId, user_id: 7, kind: 'correction', status: 'pending', version: privacyVersion, changes: { bio: 'Customer requested correction' }, outcome: null, created_at: '2026-11-03T00:00:00Z' })
const thread = id => ({ id, subject: id === 1 ? 'Synthetic support request' : 'Second synthetic request', message: 'Original customer question', status, version: supportVersion, record_version: String(supportVersion).padStart(64, '0'), admin_notes: note, messages: replies })
const fixture = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1'), path = url.pathname.replace('/api/v1/admin/', '')
  const send = (data, code = 200) => { if (!response.destroyed) { response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)) } }
  if (request.headers.authorization !== 'Bearer fixture-admin') return send({ message: 'Unauthorized' }, 401)
  if (path.startsWith('support') && !capabilities.includes('admin:support') || path.startsWith('privacy-requests') && !capabilities.includes('admin:privacy')) return send({ message: 'Reviewer access denied.' }, 403)
  let data = {}; for await (const chunk of request) data = { raw: (data.raw ?? '') + chunk }
  const body = data.raw ? JSON.parse(data.raw) : {}
  if (path === 'auth/session') return send({ role: 'admin', name: 'Synthetic reviewer', capabilities })
  if (path === 'support') return send({ data: { data: [{ id: 1, subject: 'Synthetic support request', status, created_at: '2026-11-03' }, { id: 2, subject: 'Second synthetic request', status: 'open', created_at: '2026-11-03' }], last_page: 1 } })
  if (/^support\/\d+\/thread$/.test(path)) return send({ data: thread(Number(path.split('/')[1])) })
  if (/^support\/\d+\/replies$/.test(path)) {
    replyIds.push(body.request_id)
    if (replyConflict) { replyConflict = false; supportVersion++; return send({ message: 'Conversation changed.' }, 409) }
    if (body.expected_version !== supportVersion) return send({ message: 'Conversation changed.' }, 409)
    replies.push({ id: messageId, author: 'support', body: body.body, created_at: '2026-11-03', notification_status: 'failed' }); supportVersion++
    return send({ data: thread(1) })
  }
  if (path.endsWith('/retry')) { replies = replies.map(reply => ({ ...reply, notification_status: 'queued' })); return send({ message: 'Queued' }, 202) }
  if (/^support\/\d+$/.test(path) && request.method === 'PUT') {
    if (body.expected_version !== String(supportVersion).padStart(64, '0')) return send({ message: 'Conversation changed.' }, 409)
    note = body.admin_notes ?? note; status = body.status; supportVersion++; return send({ message: 'Saved' })
  }
  if (path === 'privacy-requests') return send({ data: { data: [privacy()], last_page: 1 } })
  if (path === `privacy-requests/${privacyId}`) return send({ data: privacy() })
  if (path === `privacy-requests/${privacyId}/process`) {
    if (privacyConflict) { privacyConflict = false; privacyVersion++; return send({ message: 'Request changed.' }, 409) }
    if (body.expected_version !== privacyVersion) return send({ message: 'Request changed.' }, 409)
    decisions.push(body); privacyVersion++; return send({ data: { ...privacy(), status: body.decision === 'approve' ? 'completed' : 'held' } })
  }
  return send({ message: 'Fixture path unavailable' }, 404)
})
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve)); const address = fixture.address()
assert.ok(address && typeof address === 'object')
const reservation = createServer()
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
const frontend = reservation.address(); assert.ok(frontend && typeof frontend === 'object')
const frontendPort = frontend.port
await new Promise(resolve => reservation.close(resolve))
const origin = `http://127.0.0.1:${frontendPort}`, logs = createWriteStream(resolve(output, 'next.log'))
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(frontendPort)], {
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'development', COZY_DEPLOYMENT_ENV: 'development', COZY_INTEGRATION_FIXTURE: fixtureName, ADMIN_SESSION_SECRET: key, ADMIN_API_URL: `http://127.0.0.1:${address.port}/api/v1/admin/`, ADMIN_DASHBOARD_ORIGIN: origin, PROVIDER_DASHBOARD_ORIGIN: origin },
})
next.stdout.pipe(logs); next.stderr.pipe(logs)
let browser; let checks = 0
function passed(label) { checks++; console.log(`PASS ${label}`) }
try {
  const deadline = Date.now() + 90000
  while (true) {
    try { const result = await fetch(`${origin}/api/csrf`); if (result.status < 500) break } catch {}
    if (Date.now() > deadline) throw new Error('Local Next fixture did not start; see next.log')
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } })
  await context.route('**/*', route => { const url = new URL(route.request().url()); return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort() })
  await context.addCookies([{ name: 'cozy-admin', value: sealAdmin({ token: 'fixture-admin', expires: Date.now() + 1200000 }), url: origin }])
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${origin}/admin/manage/support`); await page.getByRole('heading', { name: 'Support conversations', exact: true }).waitFor()
  await page.getByRole('button', { name: /Synthetic support request/ }).click(); await page.getByLabel('Customer reply', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('Private staff note', { exact: true }).inputValue(), note); passed('existing customer report and separate private note render')
  await page.getByLabel('Customer reply', { exact: true }).fill('Keep my reply draft'); replyConflict = true
  await page.getByRole('button', { name: 'Send reply', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'This record has changed.' }).waitFor()
  assert.equal(await page.getByLabel('Customer reply', { exact: true }).inputValue(), 'Keep my reply draft'); passed('conflict preserves reply draft')
  await page.getByRole('button', { name: 'Refresh conversation', exact: true }).click(); await page.getByLabel('Customer reply', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Send reply', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Reply saved.' }).waitFor()
  assert.equal(replyIds.length, 2); assert.equal(replyIds[0], replyIds[1]); assert.equal(replies.length, 1); passed('refreshed retry reuses idempotency key and saves once')
  await page.getByRole('button', { name: 'Retry notification', exact: true }).click(); await page.getByText('Email notification: queued', { exact: true }).waitFor(); assert.equal(replies.length, 1); passed('notification retry preserves conversation message')
  await page.getByLabel('Private staff note', { exact: true }).fill('Private changed note')
  await page.getByRole('button', { name: 'Save private note', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Private note saved.' }).waitFor()
  assert.equal(note, 'Private changed note'); passed('private note saves separately from customer reply')
  await page.getByRole('button', { name: 'Resolve conversation', exact: true }).click(); await page.getByText('Status: resolved', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Reopen conversation', exact: true }).click(); await page.getByText('Status: open', { exact: true }).waitFor(); passed('explicit resolve and reopen persist')
  await page.setViewportSize({ width: 320, height: 800 }); await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; document.documentElement.classList.add('dark') })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); await page.screenshot({ path: resolve(output, 'support-320-dark-text200.png'), fullPage: true }); passed('support 320px dark and 200% text has no horizontal overflow')
  await page.setViewportSize({ width: 1100, height: 900 }); await page.goto(`${origin}/admin/manage/privacy-requests`)
  await page.getByRole('button', { name: 'Review correction request', exact: true }).click(); await page.getByLabel('Explanation to customer', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: /download/i }).count(), 0); passed('privacy review shows request without staff export download')
  await page.getByLabel('Decision', { exact: true }).selectOption('approve'); await page.getByLabel('Explanation to customer', { exact: true }).fill('Keep this decision explanation')
  await page.getByRole('button', { name: 'Review decision', exact: true }).click(); assert.equal(decisions.length, 0); passed('privacy action requires explicit confirmation')
  privacyConflict = true; await page.getByRole('button', { name: 'Confirm decision', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'This record has changed.' }).waitFor()
  assert.equal(await page.getByLabel('Explanation to customer', { exact: true }).inputValue(), 'Keep this decision explanation')
  await page.getByRole('button', { name: 'Refresh request', exact: true }).click(); await page.getByLabel('Explanation to customer', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('Explanation to customer', { exact: true }).inputValue(), 'Keep this decision explanation'); passed('privacy conflict refresh preserves explanation')
  await page.getByRole('button', { name: 'Review decision', exact: true }).click(); await page.getByRole('button', { name: 'Confirm decision', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Decision saved.' }).waitFor(); assert.equal(decisions.length, 1); passed('privacy decision submits one current-version action')
  await page.getByRole('button', { name: 'Review correction request', exact: true }).click(); await page.getByLabel('Explanation to customer', { exact: true }).waitFor()
  await page.setViewportSize({ width: 320, height: 800 }); await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; document.documentElement.classList.add('dark') })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); await page.screenshot({ path: resolve(output, 'privacy-320-dark-text200.png'), fullPage: true }); passed('privacy review 320px dark and 200% text has no horizontal overflow')
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); passed('privacy dialog supports keyboard dismissal')
  capabilities = ['admin:metrics']; await page.goto(`${origin}/admin/manage/support`); await page.getByRole('alert').filter({ hasText: 'requires' }).waitFor()
  assert.equal(await page.getByLabel('Private staff note', { exact: true }).count(), 0); passed('revoked support permission exposes no conversation controls')
  assert.deepEqual(errors, []); console.log(`${checks} browser checks passed; real backend tested separately in PHP.`)
} finally {
  await browser?.close(); fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve))
  if (next.pid && process.platform === 'win32') spawnSync('taskkill', ['/pid', String(next.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' }); else next.kill('SIGTERM')
  logs.end()
}
