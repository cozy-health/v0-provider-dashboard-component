import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the real bridge handler without sending credentials over the network.
const source = fs.readFileSync(new URL('../app/api/provider/[...path]/route.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, strict: true, noUncheckedIndexedAccess: true } }).outputText
class BridgeResponse extends Response {
  constructor(body, options) { super(body, options); this.cookies = new Map() }
  static json(data, options) { return new BridgeResponse(JSON.stringify(data), options) }
}

test('public provider authentication never forwards the previous account bearer', async () => {
  for (const path of ['auth/login', 'auth/register', 'auth/forgot-password', 'auth/reset-password']) {
    const seen = []
    const exports = {}
    const context = {
      exports, Buffer, URL, Headers, AbortSignal, Request, Response, process: { env: { NODE_ENV: 'test' } },
      require(name) {
        if (name === 'next/server') return { NextResponse: BridgeResponse }
        if (name === '@/lib/provider-auth-scope') return { cookieScope: () => null, scopedCookie: name => name, SCOPE_HEADER: 'X-Cozy-Provider-Scope' }
        if (name === '@/lib/provider-protection') return { retirePreviousScopes: (_request, response) => response, beginProtection: () => null, rememberedProof: () => undefined, rememberProof: response => response, protectionRequest: () => { throw new Error('Not a security request') } }
        if (name === '@/lib/provider-session') return {
          allowedRoute: () => false, apiBase: () => new URL('https://api.example.test/api/v1/provider/'),
          openSession: () => ({ token: 'previous-account-access', expires: Date.now() + 60000 }),
          sealSession: () => 'sealed-test-only', SESSION_COOKIE: 'cozy-provider', SESSION_SECONDS: 1800,
          validOrigin: () => true,
        }
        throw new Error('Unexpected dependency: ' + name)
      },
      fetch: async (url, init) => {
        seen.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) })
        return Response.json({ message: 'The credentials were not accepted.' }, { status: 401 })
      },
    }
    vm.runInNewContext(compiled, context)
    const request = new Request('https://dashboard.example.test/api/provider/' + path, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'next-account@example.test', password: 'test-only-password' }),
    })
    request.cookies = { get: () => ({ value: 'sealed-test-only' }) }
    request.nextUrl = new URL(request.url)
    const response = await exports.POST(request, { params: Promise.resolve({ path: path.split('/') }) })
    assert.equal(response.status, 401, path)
    assert.equal(seen.length, 1, path)
    assert.equal(seen[0].headers.get('Authorization'), null, path)
    assert.equal(seen[0].body.email, 'next-account@example.test', path)
  }
})
