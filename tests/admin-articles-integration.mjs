// Real isolated PHP/SQLite API + real dashboard/browser. No shared data or emails.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { createIsolatedTestApp } from './isolated-next-app.mjs'

const web = fileURLToPath(new URL('../', import.meta.url)), api = resolve(web, '../cozy-health-api-main')
const temp = await mkdtemp(join(tmpdir(), 'cozy-article-browser-'))
const database = join(temp, 'test.sqlite').replaceAll('\\', '/')
await writeFile(database, '')
const reservation = createServer()
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
const apiPort = reservation.address().port
await new Promise(resolve => reservation.close(resolve))
const apiOrigin = `http://127.0.0.1:${apiPort}`
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: `base64:${randomBytes(32).toString('base64')}`, APP_URL: apiOrigin,
  APP_CONFIG_CACHE: join(temp, 'isolated-config.php'), DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', DATABASE_URL: '',
  CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', MAIL_MAILER: 'log', LOG_CHANNEL: 'stderr', SENTRY_LARAVEL_DSN: '', SENTRY_DSN: '', BCRYPT_ROUNDS: '4', AGE_ENFORCEMENT_ENABLED: 'false', GUARDIAN_INVITATIONS_ENABLED: 'false' }
const bootstrap = join(temp, 'bootstrap-fixture.php')
await writeFile(bootstrap, `<?php
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class); $kernel->bootstrap();
if (app()->environment() !== 'testing' || config('database.default') !== 'sqlite' || realpath(config('database.connections.sqlite.database')) !== realpath(getenv('DB_DATABASE')) || !str_contains(realpath(getenv('DB_DATABASE')), 'cozy-article-browser-')) throw new RuntimeException('Isolation check failed');
$kernel->call('migrate', ['--force' => true]);
$admin = App\\Models\\User::factory()->create(['email' => 'editor@example.test', 'password' => 'Fixture7!Strong']); $admin->forceFill(['role' => 'admin'])->save();
$patient = App\\Models\\User::factory()->create();
echo json_encode(['patient_token' => $patient->createToken('isolated-browser')->plainTextToken, 'admin_token' => $admin->createToken('cozy-admin-management-v1', ['admin:content'], now()->addHour())->plainTextToken]);
`)
const fixture = JSON.parse(execFileSync('php', [bootstrap], { cwd: api, env, windowsHide: true, encoding: 'utf8' }))
const php = spawn('php', ['-S', `127.0.0.1:${apiPort}`, '-t', '.', resolve(api, 'vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php')], { cwd: resolve(api, 'public'), env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
php.stderr.on('data', chunk => appendFileSync(resolve(web, '../output/approved-plan-article-php.log'), chunk))
process.env.ADMIN_API_URL = `${apiOrigin}/api/v1/admin/`
process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex')
process.env.NODE_ENV = 'development'
const app = await createIsolatedTestApp('admin-articles')
let server, browser, exitCode = 0
const errors = []
const shots = resolve(web, '../output/admin-articles-review')

async function apiRequest(path, options = {}, admin = false) {
  return fetch(`${apiOrigin}/api/v1/${path}`, { ...options, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${admin ? fixture.admin_token : fixture.patient_token}`, ...options.headers } })
}
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await apiRequest('config')).ok) break } catch { /* Server startup. */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  const loginProbe = await fetch(`${apiOrigin}/api/v1/admin/auth/login`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'editor@example.test', password: 'Fixture7!Strong', session_mode: 'management-v1' }) })
  assert.equal(loginProbe.status, 200, `Isolated PHP login failed: ${loginProbe.status}. See output/approved-plan-article-php.log.`)
  await app.prepare()
  server = createServer(app.getRequestHandler()); server.on('upgrade', app.getUpgradeHandler())
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  process.env.ADMIN_DASHBOARD_ORIGIN = origin
  const runtime = await import(pathToFileURL(process.env.ADMIN_PLAYWRIGHT_PATH).href)
  browser = await runtime.chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(120000); page.setDefaultNavigationTimeout(120000)
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${origin}/admin/login`)
  await page.getByLabel('Email', { exact: true }).fill('editor@example.test')
  await page.getByLabel('Password', { exact: true }).fill('Fixture7!Strong')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(`${origin}/admin`)
  await page.getByRole('link', { name: 'Published Articles', exact: true }).click()
  await page.getByRole('heading', { name: 'Published articles', exact: true }).waitFor()
  await page.getByLabel('Title', { exact: true }).fill('Synthetic browser article')
  await page.getByLabel('Stable article key').fill('synthetic-browser-article')
  await page.getByRole('combobox', { name: /^Category/ }).selectOption('sleep')
  await page.getByLabel('Short introduction').fill('Synthetic browser introduction.')
  await page.getByLabel(/^Article text/).fill('Original published body.')
  await page.getByLabel('Rights or licence reference').fill('Original synthetic test fixture')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor()
  assert.equal((await apiRequest('content/articles/synthetic-browser-article')).status, 404)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('dialog').getByText('Original published body.', { exact: true }).waitFor()
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Publish approved draft' }).click()
  await page.getByRole('status').filter({ hasText: 'Article published' }).waitFor()
  assert.equal((await (await apiRequest('content/articles/synthetic-browser-article')).json()).data.body, 'Original published body.')
  await page.getByLabel(/^Article text/).fill('Revised draft body.')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor()
  const live = (await (await apiRequest('content/articles/synthetic-browser-article')).json()).data
  assert.equal(live.body, 'Original published body.'); assert.equal(Object.hasOwn(live, 'draft_payload'), false)
  const listed = (await (await apiRequest('admin/articles', {}, true)).json()).data.data
  const article = listed.find(row => row.draft.slug === 'synthetic-browser-article'); assert.ok(article)
  const concurrent = await apiRequest(`admin/articles/${article.id}`, { method: 'PUT', body: JSON.stringify({ ...article.draft, title: 'Concurrent saved title', expected_version: article.version }) }, true)
  assert.equal(concurrent.status, 200)
  await page.getByLabel('Short introduction').fill('My unsaved introduction remains visible.')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'changed' }).waitFor()
  assert.equal(await page.getByLabel('Short introduction').inputValue(), 'My unsaved introduction remains visible.')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reload saved article' }).click()
  await page.getByRole('status').filter({ hasText: 'reloaded' }).waitFor()
  assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'Concurrent saved title')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Publish approved draft' }).click()
  await page.getByRole('status').filter({ hasText: 'Article published' }).waitFor()
  assert.equal((await (await apiRequest('content/articles/synthetic-browser-article')).json()).data.body, 'Revised draft body.')
  await mkdir(shots, { recursive: true })
  await page.locator('aside').getByText('Concurrent saved title', { exact: true }).waitFor()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForFunction(() => scrollY === 0)
  await page.screenshot({ path: join(shots, 'article-editor-light-desktop.png'), fullPage: true, animations: 'disabled' })
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Unpublish', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Article unpublished' }).waitFor()
  assert.equal((await apiRequest('content/articles/synthetic-browser-article')).status, 404)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
  await page.getByText('Unpublished', { exact: true }).waitFor()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForFunction(() => scrollY === 0)
  await page.screenshot({ path: join(shots, 'article-editor-dark-mobile.png'), fullPage: true, animations: 'disabled' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  assert.deepEqual(errors, [])
  console.log('PASS real local API/browser: admin login, navigation, draft, preview, publication, private draft edits, conflict recovery, republication, unpublish and mobile layout.')
} catch (error) { exitCode = 1; console.error(error) }
finally {
  await browser?.close()
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 5000))])
  php.kill()
}
process.exit(exitCode)
