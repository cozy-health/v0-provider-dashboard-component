// Isolated synthetic audio only. No deployed API or patient data.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createIsolatedTestApp } from './isolated-next-app.mjs'
import { sealSession, SESSION_COOKIE } from '../lib/provider-session.ts'

const audioId = 'aabbccdd-1234-4567-89ab-0123456789ab'
const provider = { id: 1, name: 'Voice Test Provider', email: 'voice@example.test', practice: 'Synthetic practice', timezone: 'UTC' }
let uploads = 0, failMessage = true, messageAttempts = [], messages = [], releaseFirstMessage
let notifyFirstMessage
const firstMessageStarted = new Promise(resolve => { notifyFirstMessage = resolve })
const backend = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost'), path = url.pathname.replace('/api/v1/provider/', '')
  const chunks = []; for await (const chunk of request) chunks.push(chunk)
  const bytes = Buffer.concat(chunks)
  const json = (data, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(data)) }
  if (request.headers.authorization !== 'Bearer synthetic-voice-token') return json({}, 401)
  if (path === 'me') return json({ data: { provider } })
  if (path === 'consent-config') return json({ consent: { enforce_blocking: false, documents: {} } })
  if (path === 'me/consents') return json({ owner_id: 1, data: [] })
  if (path === 'clients') return json([])
  if (path === 'conversations') return json([{ id: 1, user_id: 10, name: 'Synthetic patient', unread: 0 }])
  if (path === 'conversations/1/read') return json({})
  if (path === 'conversations/1/messages' && request.method === 'GET') return json({ data: messages, has_more: false })
  if (path === 'conversations/1/messages') {
    const payload = JSON.parse(bytes.toString())
    messageAttempts.push(payload)
    if (failMessage) { failMessage = false; await new Promise(resolve => { releaseFirstMessage = resolve; notifyFirstMessage() }); return json({ message: 'Synthetic retry failure' }, 503) }
    if (!messages.length) messages.push({ id: 1, content: '', records: [], sender: 'provider', audio: { id: audioId, duration: 2 }, created_at: new Date().toISOString() })
    return json({ id: 1 }, 201)
  }
  if (path === 'audio-attachments') {
    uploads++
    const form = await new Response(bytes, { headers: { 'Content-Type': request.headers['content-type'] } }).formData()
    assert.equal(form.get('purpose'), 'message'); assert.equal(form.get('provider_client_link_id'), '1')
    assert.ok(Number(form.get('duration')) >= 1); assert.ok(form.get('audio').size > 0)
    return json({ id: audioId, duration: 2 }, 201)
  }
  if (path === `audio-attachments/${audioId}`) {
    assert.equal(request.headers.range, 'bytes=0-3')
    response.writeHead(206, { 'Content-Type': 'audio/mp4', 'Content-Range': 'bytes 0-3/8', 'Accept-Ranges': 'bytes', 'Content-Length': '4' }); response.end(Buffer.from([1, 2, 3, 4])); return
  }
  return json({}, 404)
})
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve))
process.env.NODE_ENV = 'development'
process.env.PROVIDER_API_URL = `http://127.0.0.1:${backend.address().port}/api/v1/provider/`
process.env.PROVIDER_SESSION_SECRET = randomBytes(32).toString('hex')
const app = await createIsolatedTestApp('voice-contract')
let server, browser, page, exitCode = 0
const sockets = new Set()
try {
  await app.prepare(); server = createServer(app.getRequestHandler())
  server.on('upgrade', app.getUpgradeHandler())
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  process.env.PROVIDER_DASHBOARD_ORIGIN = origin
  const session = sealSession({ token: 'synthetic-voice-token', expires: Date.now() + 600000 })
  const csrfResponse = await fetch(`${origin}/api/csrf`), csrfCookie = csrfResponse.headers.get('set-cookie').split(';')[0], csrf = (await csrfResponse.json()).token
  const headers = { Cookie: `${SESSION_COOKIE}=${session}; ${csrfCookie}`, Origin: origin, 'X-Cozy-Request': '1', 'X-CSRF-Token': csrf }
  const form = new FormData(); form.set('purpose', 'message'); form.set('provider_client_link_id', '1'); form.set('duration', '2'); form.set('audio', new Blob(['synthetic audio'], { type: 'audio/mp4' }), 'voice.m4a')
  assert.equal((await fetch(`${origin}/api/provider/audio-attachments`, { method: 'POST', headers: { ...headers, Origin: 'https://untrusted.test' }, body: form })).status, 403)
  assert.equal(uploads, 0)
  assert.equal((await fetch(`${origin}/api/provider/audio-attachments`, { method: 'POST', headers, body: form })).status, 201)
  const playback = await fetch(`${origin}/api/provider/audio-attachments/${audioId}`, { headers: { ...headers, Range: 'bytes=0-3' } })
  assert.equal(playback.status, 206); assert.equal(playback.headers.get('content-range'), 'bytes 0-3/8'); assert.equal((await playback.arrayBuffer()).byteLength, 4)
  assert.match(playback.headers.get('cache-control'), /no-store/)
  assert.equal((await fetch(`${origin}/api/provider/audio-attachments/${audioId}`)).status, 401)
  uploads = 0

  if (process.env.PROVIDER_PLAYWRIGHT_PATH) {
    const { chromium } = await import(pathToFileURL(process.env.PROVIDER_PLAYWRIGHT_PATH).href)
    browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'], ...(process.env.PROVIDER_CHROMIUM_PATH ? { executablePath: process.env.PROVIDER_CHROMIUM_PATH } : {}) })
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['microphone'] })
    await context.addCookies([{ name: SESSION_COOKIE, value: session, url: origin, httpOnly: true, sameSite: 'Lax' }])
    await context.routeWebSocket('**/_next/webpack-hmr**', () => {})
    page = await context.newPage(); const errors = []
    async function capture(state) {
      for (const theme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
        await page.waitForFunction(theme => document.documentElement.classList.contains(theme), theme)
        await page.screenshot({ path: `scratch/voice-${state}-${theme}.png` })
      }
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    }
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin)
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Messages', exact: true }).click()
    await page.getByRole('button', { name: 'Record voice message', exact: true }).click()
    const popup = page.getByRole('dialog', { name: 'Voice message recorder' })
    await popup.getByRole('button', { name: 'Stop', exact: true }).waitFor()
    await page.waitForFunction(() => { const timer = document.querySelector('[role="dialog"] .tabular-nums'); return timer && timer.textContent !== '0:00' })
    assert.equal(uploads, 0)
    const desktop = await popup.boundingBox(); assert.ok(desktop.height < 400); assert.ok(desktop.width <= 330)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(() => { const bounds = document.querySelector('[role="dialog"][aria-label="Voice message recorder"]')?.getBoundingClientRect(); return bounds && bounds.left >= 0 && bounds.right <= window.innerWidth })
    const mobile = await popup.boundingBox(); assert.ok(mobile.x >= 0); assert.ok(mobile.x + mobile.width <= 390)
    assert.equal(await popup.locator('svg[viewBox="0 0 240 56"] rect').count(), 48)
    await capture('recording')
    await popup.getByRole('button', { name: 'How is this saved?', exact: true }).click()
    await popup.getByText('Private until you send', { exact: true }).waitFor()
    await popup.getByRole('button', { name: 'How is this saved?', exact: true }).click()
    await popup.getByRole('button', { name: 'Stop', exact: true }).click()
    await popup.getByText('Preview voice message', { exact: true }).waitFor()
    await popup.getByRole('button', { name: 'Play preview', exact: true }).click()
    await popup.getByRole('button', { name: 'Pause preview', exact: true }).click()
    await popup.getByRole('slider', { name: 'Preview position', exact: true }).focus()
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight')
    assert.ok(Number(await popup.getByRole('slider', { name: 'Preview position' }).getAttribute('aria-valuenow')) > 0)
    await capture('preview')
    assert.equal(uploads, 0); assert.equal(messageAttempts.length, 0)
    await popup.getByRole('button', { name: 'Send', exact: true }).click()
    await popup.getByRole('progressbar', { name: 'Sending voice message' }).waitFor()
    await capture('sending')
    await firstMessageStarted
    releaseFirstMessage?.()
    await popup.getByText('The provider service is temporarily unavailable.', { exact: false }).waitFor()
    await capture('error')
    assert.equal(uploads, 1)
    await popup.getByRole('button', { name: 'Send', exact: true }).click()
    await popup.waitFor({ state: 'hidden' })
    assert.equal(uploads, 1); assert.equal(messageAttempts.length, 2)
    assert.equal(messageAttempts[0].client_id, messageAttempts[1].client_id)
    assert.equal(messageAttempts[1].audio_attachment_id, audioId)
    await page.getByLabel('Voice message', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    await page.screenshot({ path: 'scratch/voice-recording-result.png' })
  }
  console.log('Voice multipart bridge, authentication, CSRF, range playback and optional browser recording checks passed.')
} catch (error) { exitCode = 1; console.error(error); if (page) { console.error(await page.locator('[role="dialog"]').allTextContents()); await page.screenshot({ path: 'scratch/voice-recording-failure.png' }) } }
finally {
  releaseFirstMessage?.()
  await browser?.close(); for (const socket of sockets) socket.destroy()
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 5000))])
  backend.closeAllConnections(); await new Promise(resolve => backend.close(resolve))
}
process.exit(exitCode)
