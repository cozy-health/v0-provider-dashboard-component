// Local-only preview. Uses the existing isolated contract fixtures, never Railway.
import { createServer, request as proxyRequest } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { createIsolatedTestApp } from '../tests/isolated-next-app.mjs'
import { sealAdmin, ADMIN_COOKIE } from '../lib/admin-session.ts'
import { sealSession, SESSION_COOKIE } from '../lib/provider-session.ts'

if (process.env.NODE_ENV === 'production') throw new Error('Design preview is development only')
await mkdir(new URL('../scratch/', import.meta.url), { recursive: true })
for (const [original, target] of [['provider-integration.mjs', 'design-provider-fixture.mjs'], ['admin-management-integration.mjs', 'design-management-fixture.mjs'], ['admin-integration.mjs', 'design-metrics-fixture.mjs']]) {
  const source = await readFile(new URL('../tests/' + original, import.meta.url), 'utf8')
  const marker = 'const app = await createIsolatedTestApp'
  if (!source.includes(marker)) throw new Error('Preview fixture entry changed; review before starting')
  let fixture = source.split(marker)[0]
    .replaceAll("'./theme-design-review.mjs'", "'../tests/theme-design-review.mjs'")
    .replaceAll("'./isolated-next-app.mjs'", "'../tests/isolated-next-app.mjs'")
    .replace('theme: "system"', 'theme: "dark"')
  if (original.startsWith('provider-')) {
    fixture = fixture.replace("name: 'Test Provider'", "name: 'Avery Morgan'").replace("name: 'Test'", "name: 'Maya Lin'") + '\npopulatedHistory = true;\n'
    // Illustrative preview only. Keep normal contract fixtures and production data untouched.
    const marker = "if (path === 'clients/10/insights')"
    const start = fixture.indexOf(marker), end = fixture.indexOf("if (path === 'clients/10/moods')", start)
    if (start < 0 || end < 0) throw new Error('Review insight fixture boundaries before editing the preview')
    const buckets = [3,4,3.5,5.5,5,6.5,7.5].map((intensity,index) => ({key:`2026-11-0${index+1}`,label:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][index],start:`2026-11-0${index+1}`,end:`2026-11-0${index+1}`,check_ins:1,positive:0,negative:0,neutral:1,unclassified:0,average_intensity:intensity}))
    let insights = fixture.slice(start,end)
    insights = insights.replace(/buckets: \[.*?\], trend: null/s, 'buckets: ' + JSON.stringify(buckets) + ', trend: null')
      .replace('check_ins: 1, recorded_days: 1', 'check_ins: 7, recorded_days: 7')
      .replace('positive: 0, negative: 1, neutral: 0', 'positive: 0, negative: 0, neutral: 7')
      .replace('average_intensity: 4, moods:', 'average_intensity: 5, moods:')
    fixture = fixture.slice(0,start) + insights + fixture.slice(end)
  }
  if (original.startsWith('admin-management')) fixture = fixture.replace("'admin:subscriptions']", "'admin:subscriptions', 'admin:support', 'admin:privacy']")
  if (original === 'admin-integration.mjs') {
    const daily = Array.from({ length: 30 }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}`, signups: { status: 'available', count: 5 + index % 7 * 5 }, active: { status: 'available', count: 40 + index % 9 * 5 } }))
    const newUsers = daily.reduce((sum, day) => sum + day.signups.count, 0)
    fixture = fixture.replace('daily: []', 'daily: ' + JSON.stringify(daily))
      .replace('new_users: suppressed', 'new_users: ' + JSON.stringify({status:'available',count:newUsers}))
      .replace('active_users: suppressed', 'active_users: ' + JSON.stringify({status:'available',count:180}))
      .replace('community_posts: suppressed', 'community_posts: ' + JSON.stringify({status:'available',count:75}))
      .replace("from: '2026-07-03'", "from: '2026-09-01'")
    const activity = Array.from({ length: 5 }, (_, index) => ({id:index+1,action:['Article updated','Support reply sent','Assessment published','Privacy request reviewed','Community report resolved'][index],resource:['articles','support','quizzes','privacy-requests','reports'][index],created_at:`2026-09-30T${String(16-index).padStart(2,'0')}:20:00Z`}))
    fixture = fixture.replace('activity: []', 'activity: ' + JSON.stringify(activity))
  }
  fixture += '\nexport const port = backend.address().port;\nexport const closeFixture = () => backend.close();\n'
  await writeFile(new URL('../scratch/' + target, import.meta.url), fixture)
}
const provider = await import('../scratch/design-provider-fixture.mjs')
const management = await import('../scratch/design-management-fixture.mjs')
const metrics = await import('../scratch/design-metrics-fixture.mjs')
const router = createServer((incoming, outgoing) => {
  const path = new URL(incoming.url, 'http://127.0.0.1').pathname
  const metric = path.includes('/metrics/') || path.endsWith('/operations/summary')
  const target = proxyRequest({ hostname: '127.0.0.1', port: metric ? metrics.port : management.port,
    path: incoming.url, method: incoming.method, headers: { ...incoming.headers,
      authorization: metric ? 'Bearer fixture-admin-token' : incoming.headers.authorization } }, upstream => {
    outgoing.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(outgoing)
  })
  target.on('error', () => { outgoing.writeHead(502); outgoing.end() })
  incoming.pipe(target)
})
await new Promise(resolve => router.listen(0, '127.0.0.1', resolve))
process.env.ADMIN_API_URL = `http://127.0.0.1:${router.address().port}/api/v1/admin/`
process.env.PROVIDER_API_URL = `http://127.0.0.1:${provider.port}/api/v1/provider/`
process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString('hex')
process.env.PROVIDER_SESSION_SECRET = randomBytes(32).toString('hex')
const port = Number(process.env.COZY_DESIGN_PORT || 3100)
process.env.ADMIN_DASHBOARD_ORIGIN = `http://127.0.0.1:${port}`
process.env.PROVIDER_DASHBOARD_ORIGIN = `http://127.0.0.1:${port}`
const app = await createIsolatedTestApp('dashboard-redesign-preview')
await app.prepare()
const handler = app.getRequestHandler()
const server = createServer((req, res) => {
  const path = new URL(req.url, `http://127.0.0.1:${port}`).pathname
  if (path === '/__preview/provider' || path === '/__preview/admin') {
    const admin = path.endsWith('/admin'), expires = Date.now() + 8 * 60 * 60 * 1000
    const cookie = admin ? `${ADMIN_COOKIE}=${sealAdmin({ token: 'local-management-fixture', expires })}`
      : `${SESSION_COOKIE}=${sealSession({ token: 'test-bearer-secret', expires })}`
    res.writeHead(302, { 'Set-Cookie': `${cookie}; HttpOnly; SameSite=Lax; Path=/`,
      Location: admin ? '/admin' : '/provider', 'Cache-Control': 'no-store' }); res.end(); return
  }
  return handler(req, res)
})
server.on('upgrade', app.getUpgradeHandler())
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
console.log(`Synthetic local review: http://127.0.0.1:${port}/__preview/provider and /__preview/admin`)
async function close() { server.close(); router.close(); provider.closeFixture(); management.closeFixture(); metrics.closeFixture(); await app.close(); process.exit(0) }
process.on('SIGINT', close); process.on('SIGTERM', close)
