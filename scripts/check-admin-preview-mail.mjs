import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const api = resolve('../cozy-health-api-main')
const origin = 'http://127.0.0.1:8000/api/v1/'
const env = { ...process.env, APP_ENV: 'local', DB_CONNECTION: 'sqlite', DB_DATABASE: resolve(api, 'storage/admin-preview.sqlite'), MAIL_MAILER: 'log', QUEUE_CONNECTION: 'database', CACHE_STORE: 'file' }
async function request(path, body, token) {
 const response = await fetch(origin + path, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
 assert.ok(response.ok, `${path}: ${response.status}`)
 return response.json()
}
function work() { execFileSync('php', ['artisan', '--env=admin-preview', 'queue:work', 'database', '--queue=email,default', '--stop-when-empty', '--tries=1'], { cwd: api, env, stdio: 'pipe' }) }
const log = resolve(api, 'storage/logs/laravel.log')
const offset = readFileSync(log, 'utf8').length
const login = await request('admin/auth/login', { email: 'admin@cozy.local', password: 'CozyLocal!Review2026', session_mode: 'management-v1' })
await request('admin/emails/test', { email: 'local-mail-check@example.test' }, login.token)
work()
assert.ok(readFileSync(log, 'utf8').slice(offset).includes('The Cozy Health email queue is working.'))
const resetOffset = readFileSync(log, 'utf8').length
await request('auth/forgot-password', { email: 'member1@example.test' })
work()
const captured = readFileSync(log, 'utf8').slice(resetOffset)
const code = captured.match(/Your reset code is:\s*(\d{6})/)?.[1]
assert.ok(code, 'A reset code must be captured by the local log mailer')
await request('auth/reset-password', { email: 'member1@example.test', token: code, password: 'SyntheticFixture!2026' })
work()
await request('admin/auth/logout', {}, login.token)
console.log('PASS local email queue capture and actual password reset; no external email sent.')
