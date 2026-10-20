import { existsSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const api = resolve(web, '../cozy-health-api-main')
const database = resolve(api, 'storage/admin-preview.sqlite').replaceAll('\\', '/')
const config = resolve(api, '.env.admin-preview')
if (!existsSync(config)) writeFileSync(config, `APP_NAME=CozyLocal\nAPP_ENV=local\nAPP_KEY=base64:${randomBytes(32).toString('base64')}\nAPP_DEBUG=true\nAPP_URL=http://127.0.0.1:8000\nDB_CONNECTION=sqlite\nDB_DATABASE=${database}\nCACHE_STORE=file\nSESSION_DRIVER=file\nQUEUE_CONNECTION=database\nMAIL_MAILER=log\nMAIL_FROM_ADDRESS=local@example.test\nMAIL_FROM_NAME=Cozy\nLOG_CHANNEL=single\n`)
if (!existsSync(database)) writeFileSync(database, '')
const dashboardConfig = resolve(web, '.env.local')
if (!existsSync(dashboardConfig)) writeFileSync(dashboardConfig, `ADMIN_API_URL=http://127.0.0.1:8000/api/v1/admin/\nADMIN_DASHBOARD_ORIGIN=http://localhost:3000\nADMIN_SESSION_SECRET=${randomBytes(32).toString('hex')}\n`)
// Override inherited database/mail configuration, never read production credentials.
const env = { ...process.env, APP_ENV: 'local', DB_CONNECTION: 'sqlite', DB_DATABASE: database, MAIL_MAILER: 'log', QUEUE_CONNECTION: 'database', CACHE_STORE: 'file' }
for (const args of [['migrate', '--force'], ['db:seed', '--class=AdminPreviewSeeder', '--force']]) execFileSync('php', ['artisan', '--env=admin-preview', ...args], { cwd: api, env, stdio: 'inherit' })
console.log('Local admin: http://localhost:3000/admin | admin@cozy.local | CozyLocal!Review2026')
if (process.argv.includes('--serve')) {
 // no-reload preserves the isolated environment in Laravel's PHP child process.
 const child = spawn('php', ['artisan', '--env=admin-preview', 'serve', '--host=127.0.0.1', '--port=8000', '--no-reload'], { cwd: api, env, stdio: 'inherit' })
 child.on('exit', code => process.exit(code ?? 1))
}
