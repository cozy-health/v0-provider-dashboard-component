// Local synthetic moderation contracts only; no real user restrictions or mail.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createIsolatedTestApp } from './isolated-next-app.mjs'
import { sealAdmin, ADMIN_COOKIE } from '../lib/admin-session.ts'

const banId = '11111111-1111-4111-8111-111111111111', appealId = '22222222-2222-4222-8222-222222222222'
const version = '33333333-3333-4333-8333-333333333333'
let allowed = true, conflict = true, decisions = [], appeals = [], writes = []
const pageOf = data => ({ data, current_page: 1, last_page: 1 })
const backend = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'), path = url.pathname.replace('/api/v1/admin/', '')
  let raw = ''; for await (const chunk of req) raw += chunk
  const body = raw ? JSON.parse(raw) : {}
  const send = (value, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)) }
  if (req.headers.authorization !== 'Bearer moderation-fixture') return send({}, 401)
  if (path === 'auth/session') return send({ role: 'admin', name: 'Synthetic moderator', capabilities: allowed ? ['admin:moderation'] : [] })
  if (!allowed) return send({ message: 'Permission withdrawn.' }, 403)
  if (path === 'community-moderation') return send({ data: pageOf(decisions), appeals: pageOf(appeals) })
  writes.push({ path, body })
  if (path === 'community-moderation/bans') {
    assert.equal(body.user_id, 42); assert.equal(body.duration, '7d'); assert.equal(body.reason, 'Synthetic guideline reason')
    decisions = [{ id: banId, user_id: 42, kind: 'ban', reason: body.reason, status: 'active', expires_at: '2026-11-20T12:00:00Z', version }]
    return send({ data: decisions[0] }, 201)
  }
  if (path === `community-moderation/bans/${banId}/lift`) {
    assert.equal(body.expected_version, version); assert.equal(body.reason, 'Reviewed restriction lifted')
    decisions[0].status = 'lifted'; return send({ message: 'Lifted' })
  }
  if (path === `community-moderation/appeals/${appealId}/review`) {
    assert.equal(body.reason, 'Reviewed content is allowed')
    if (conflict) { conflict = false; return send({ message: 'Stale decision' }, 409) }
    if (!body.confirm_republish) return send({ message: 'Confirm republishing' }, 422)
    assert.equal(body.decision, 'accepted'); assert.equal(body.expected_version, version)
    appeals = []; return send({ message: 'Accepted' })
  }
  return send({ message: 'Unexpected fixture path' }, 404)
})
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve))
process.env.ADMIN_API_URL = `http://127.0.0.1:${backend.address().port}/api/v1/admin/`
process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex')
const app = await createIsolatedTestApp('community-moderation')
let server, browser, page
const sockets = new Set()
try {
  await app.prepare(); server = createServer(app.getRequestHandler()); server.on('upgrade', app.getUpgradeHandler()); server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`; process.env.ADMIN_DASHBOARD_ORIGIN = origin
  const { chromium } = await import(pathToFileURL(process.env.ADMIN_PLAYWRIGHT_PATH).href)
  browser = await chromium.launch({ headless: true }); const context = await browser.newContext()
  await context.addCookies([{ name: ADMIN_COOKIE, value: sealAdmin({ token: 'moderation-fixture', expires: Date.now() + 1200000 }), url: origin }])
  page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept())
  page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(120000)
  await page.goto(origin + '/admin/manage/community-moderation')
  await page.getByText('No decisions yet.', { exact: true }).waitFor()
  await page.getByLabel('User ID', { exact: true }).fill('42')
  await page.getByLabel('Reason shown to user').fill('Synthetic guideline reason')
  await page.getByRole('button', { name: 'Apply restriction', exact: true }).click()
  await page.getByText('Synthetic guideline reason', { exact: true }).waitFor()
  await page.getByLabel('Reason for lifting').fill('Reviewed restriction lifted')
  await page.getByRole('button', { name: 'Lift restriction', exact: true }).click()
  await page.getByText('User 42: ban · lifted', { exact: true }).waitFor()
  console.log('PASS restriction creation and versioned early lift through real Next bridge')
  appeals = [{ id: appealId, decision_id: banId, user_id: 42, message: 'Please review removal', version, status: 'pending', decision: { kind: 'post', status: 'active', reason: 'Synthetic removal', target_id: banId } }]
  await page.getByRole('button', { name: 'Refresh moderation', exact: true }).click()
  await page.getByText('Please review removal', { exact: true }).waitFor()
  await page.getByLabel('Decision reason', { exact: true }).fill('Reviewed content is allowed')
  await page.getByRole('button', { name: 'Accept appeal', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.getByLabel('Decision reason', { exact: true }).inputValue(), 'Reviewed content is allowed')
  await page.getByRole('button', { name: 'Accept appeal', exact: true }).click()
  await page.getByRole('alert').waitFor(); assert.equal(appeals.length, 1)
  await page.getByLabel('I confirm republishing unchanged content if this is a content appeal.').check()
  await page.getByRole('button', { name: 'Accept appeal', exact: true }).click()
  await page.getByText('No pending appeals.', { exact: true }).waitFor()
  console.log('PASS stale appeal recovery preserves explanation and requires explicit content republishing confirmation')
  await page.setViewportSize({ width: 320, height: 812 }); await page.evaluate(() => document.documentElement.style.fontSize = '200%')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  allowed = false; await page.getByRole('button', { name: 'Refresh moderation', exact: true }).click()
  await page.getByRole('alert').waitFor(); await page.waitForFunction(() => !document.body.innerText.includes('User 42:'))
  assert.equal(await page.getByRole('button', { name: 'Apply restriction', exact: true }).isDisabled(), true)
  assert.deepEqual(errors, [])
  console.log('PASS 320px/200% layout and permission withdrawal; no runtime errors')
} catch (failure) {
  if (page) console.error('Moderation failure DOM:', await page.locator('body').innerText())
  throw failure
} finally {
  if (browser) await browser.close()
  if (server) { for (const socket of sockets) socket.destroy(); server.close() }
  await app.close(); backend.closeAllConnections(); backend.close()
}
