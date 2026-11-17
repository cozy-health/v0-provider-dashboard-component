import test from 'node:test'
import assert from 'node:assert/strict'
import { bridge, scopeA } from './helpers/provider-bridge.mjs'
function authenticated(respond) {
  const h=bridge(respond)
  h.jar.set('cozy-provider.'+scopeA,h.session.sealSession({token:'fixture-access',expires:Date.now()+60000},scopeA))
  return h
}
for (const path of ['clients','reports/1/pdf']) {
  test('required consent recovery survives the provider bridge: '+path, async()=>{
    const h=authenticated(()=>Response.json({message:'Review required documents.',code:'consent_required'},{status:403}))
    const response=await h.request(path)
    assert.equal(response.status,403)
    assert.equal((await response.json()).code,'consent_required')
    assert.equal(response.headers.get('cache-control'),'private, no-store')
    assert.equal(response.written.some(cookie=>cookie.name==='cozy-provider.'+scopeA&&cookie.options.maxAge===0),false)
  })
}
test('arbitrary upstream error codes are not forwarded', async()=>{
  const h=authenticated(()=>Response.json({message:'Unavailable.',code:'internal-diagnostic-fixture'},{status:403}))
  assert.equal((await (await h.request('clients')).json()).code,undefined)
})

test('consent recovery also survives revocation between report authorization and file fetch',async()=>{
  const h=authenticated(call=>call.path==='reports/1/download' ? Response.json({download_url:'https://api.example.test/api/v1/provider/reports/1/file?expires=1&signature=fixture'}) : Response.json({code:'consent_required'},{status:403}))
  const response=await h.request('reports/1/pdf')
  assert.equal(response.status,403)
  assert.equal((await response.json()).code,'consent_required')
})
