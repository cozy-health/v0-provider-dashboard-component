import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { CSRF_COOKIE, csrfToken } from '../../lib/csrf-server.mjs'
const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '../..')
class CookieResponse extends Response {
  constructor(body, options) { super(body, options); this.written = []; this.cookies = { set: (name, value, options) => { this.written.push({ name, value, options }) } } }
  static json(value, options) { return new CookieResponse(JSON.stringify(value), options) }
}
export const scopeA = 'a'.repeat(64), scopeB = 'b'.repeat(64)
export function bridge(respond, scope = scopeA) {
  process.env.PROVIDER_SESSION_SECRET = 'c'.repeat(64)
  process.env.PROVIDER_DASHBOARD_ORIGIN = 'https://dashboard.example.test'
  process.env.PROVIDER_API_URL = 'https://api.example.test/api/v1/provider/'
  const cache = new Map(), calls = []
  const load = filename => {
    filename = path.resolve(filename)
    if (cache.has(filename)) return cache.get(filename)
    const exports = {}; cache.set(filename, exports)
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, strict: true, noUncheckedIndexedAccess: true } }).outputText
    vm.runInNewContext(source, { exports, Buffer, URL, Headers, Request, Response, AbortSignal, Date, process, console, fetch: async (url, init) => { const body = init.body ? JSON.parse(init.body) : undefined; const call = { path: new URL(url).pathname.replace('/api/v1/provider/', ''), method: init.method, headers: new Headers(init.headers), body }; calls.push(call); return respond(call) }, require(name) {
      if (name === 'next/server') return { NextResponse: CookieResponse }
      if (name.startsWith('@/')) return load(path.join(root, name.slice(2) + '.ts'))
      if (name.startsWith('./') && !name.endsWith('.mjs')) return load(path.resolve(path.dirname(filename), name + '.ts'))
      return require(name.startsWith('.') ? path.resolve(path.dirname(filename), name) : name)
    } }, { filename })
    return exports
  }
  const session = load(path.join(root, 'lib/provider-session.ts'))
  const route = load(path.join(root, 'app/api/provider/[...path]/route.ts'))
  const jar = new Map([[CSRF_COOKIE, csrfToken()], ...(scope ? [['cozy-provider-scope', scope]] : [])])
  const apply = response => { for (const c of response.written) { if (c.options.maxAge === 0) jar.delete(c.name); else jar.set(c.name, c.value) } }
  async function request(routePath, method = 'GET', body, expectedScope = jar.get('cozy-provider-scope'), snapshot = new Map(jar)) {
    const url = new URL('/api/provider/' + routePath, 'https://dashboard.example.test')
    const headers = { origin: 'https://dashboard.example.test', 'x-cozy-request': '1', 'x-csrf-token': snapshot.get(CSRF_COOKIE), 'content-type': 'application/json', cookie: [...snapshot].map(([k,v]) => `${k}=${v}`).join('; '), ...(expectedScope ? { 'x-cozy-provider-scope': expectedScope } : {}) }
    const input = new Request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    input.cookies = { get: name => snapshot.has(name) ? { value: snapshot.get(name) } : undefined, getAll: () => [...snapshot].map(([name,value]) => ({name,value})) }; input.nextUrl = url
    return route[method](input, { params: Promise.resolve({ path: routePath.split('?')[0].split('/') }) })
  }
  return { jar, calls, request, apply, session }
}
export const payload = data => Response.json({ data })
export function check(method = 'email', delivery = 'queued') { return { challenge_required: true, challenge_token: 'd'.repeat(64), method, expires_at: new Date(Date.now() + 600000).toISOString(), questions: method === 'questions' ? [{id:'place',prompt:'Secret place?'},{id:'book',prompt:'Secret book?'}] : [], email_delivery: delivery } }
export const prefs = enrolled => ({ enabled: true, enrolled, method: 'questions', questions: { place:'Secret place?', book:'Secret book?', word:'Secret word?' } })
export const verified = (enroll = true, email = 'provider@example.test') => ({ challenge_required:false, security_enrollment_required:enroll, provider:{id:42,email}, token:'provisional-access',refresh_token:'e'.repeat(64),device_proof:'f'.repeat(64),security_settings_token:'1'.repeat(64) })