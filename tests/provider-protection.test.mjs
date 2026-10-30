import test from 'node:test'
import assert from 'node:assert/strict'
import { bridge, check, payload, prefs, verified, scopeA, scopeB } from './helpers/provider-bridge.mjs'
const start = async h => { const r = await h.request('auth/login','POST',{email:'provider@example.test',password:'fixture-password'}); assert.equal(r.status,200);h.apply(r);return r }
const action = (h, name, fields = {}) => h.request('auth/protection','POST',{action:name,...fields})
const verify = async h => { const r = await action(h,'verify',{code:'123456'});assert.equal(r.status,200);h.apply(r);return r }
const pendingName = `cozy-provider-pending.${scopeA}`, sessionName = `cozy-provider.${scopeA}`

test('provider enrollment keeps all credentials encrypted and private access unavailable until explicit completion', async () => {
  let enrolled = false
  const h = bridge(call => {
    if (call.path === 'auth/login') { assert.equal(call.headers.get('authorization'),null); return payload(check()) }
    if (call.path === 'auth/challenge/verify') return payload(verified())
    if (call.path === 'auth/security' && call.method === 'GET') return payload(prefs(enrolled))
    if (call.path === 'auth/security' && call.method === 'PUT') { assert.equal(call.body.security_settings_token,'1'.repeat(64));assert.equal(call.headers.get('authorization'),'Bearer provisional-access');enrolled=true;return payload({...prefs(true),method:'questions'}) }
    throw Error('Unexpected request ' + call.path)
  })
  const first = await start(h)
  assert.equal(first.headers.get('cache-control'),'private, no-store')
  assert.equal(JSON.stringify(await first.json()).includes('d'.repeat(64)),false)
  assert.equal(first.written[0].options.httpOnly,true)
  await verify(h)
  assert.equal(h.jar.has(sessionName),false)
  assert.equal((await h.request('me')).status,401)
  const loaded = await h.request('auth/protection');assert.equal((await loaded.json()).preferences.enrolled,false)
  assert.equal((await action(h,'complete')).status,403)
  const saved = await action(h,'save',{method:'questions',questions:['place','book','word'].map(id=>({id,answer:'private secret answer'}))});assert.equal(saved.status,200);h.apply(saved)
  assert.equal(h.jar.has(sessionName),false)
  const done = await action(h,'complete');assert.equal(done.status,200);h.apply(done)
  assert.equal(h.jar.has(pendingName),false)
  const cookie = h.jar.get(sessionName)
  assert.equal(h.session.openSession(cookie,scopeA).token,'provisional-access')
  assert.equal(h.session.openSession(cookie,scopeB),null)
  assert.equal(h.session.openSession(cookie),null)
  const publicResult = JSON.stringify(await done.json())
  for(const secret of ['provisional-access','private secret answer','e'.repeat(64),'f'.repeat(64)]) assert.equal(publicResult.includes(secret),false)
})

test('lost save acknowledgment requires reconciliation and cannot activate or reuse the settings ticket', async () => {
  let enrolled = false, saves = 0
  const h = bridge(call => {
    if(call.path==='auth/login')return payload(check())
    if(call.path==='auth/challenge/verify')return payload(verified())
    if(call.path==='auth/security'&&call.method==='GET')return payload({...prefs(enrolled),method:'email'})
    if(call.path==='auth/security'&&call.method==='PUT'){saves++;enrolled=true;throw new TypeError('Connection lost after commit')}
    throw Error('Unexpected request')
  })
  await start(h);await verify(h)
  const saved = await action(h,'save',{method:'email'});assert.equal(saved.status,503);h.apply(saved)
  assert.equal((await saved.json()).uncertain,true)
  assert.equal(h.jar.has(sessionName),false)
  assert.equal((await action(h,'save',{method:'email'})).status,403)
  assert.equal(saves,1)
  const recovered = await action(h,'reconcile');assert.equal(recovered.status,200);h.apply(recovered)
  assert.equal((await recovered.json()).stage,'ready');assert.equal(h.jar.has(sessionName),false)
  const done = await action(h,'complete');assert.equal(done.status,200);h.apply(done);assert.equal(h.jar.has(sessionName),true)
})

test('provider settings require current password and fresh email proof and do not replace the active session', async () => {
  let enrolled = true
  const h = bridge(call => {
    if(call.path==='auth/security'&&call.method==='GET')return payload(prefs(enrolled))
    if(call.path==='auth/security/reauthenticate'){assert.equal(call.body.password,'fixture-password');return payload(check())}
    if(call.path==='auth/challenge/verify')return payload({verified:true,security_settings_token:'2'.repeat(64)})
    if(call.path==='auth/security'&&call.method==='PUT'){enrolled=true;return payload({...prefs(true),method:'email'})}
    throw Error('Unexpected request')
  })
  const active = h.session.sealSession({token:'existing-session',email:'provider@example.test',expires:Date.now()+60000},scopeA);h.jar.set(sessionName,active)
  const settings = await action(h,'settings');assert.equal(settings.status,200);h.apply(settings)
  assert.equal((await action(h,'save',{method:'email'})).status,403)
  const identity = await action(h,'identity',{password:'fixture-password'});assert.equal(identity.status,200);h.apply(identity)
  await verify(h)
  const saved=await action(h,'save',{method:'email'});assert.equal(saved.status,200);h.apply(saved)
  const done=await action(h,'complete');assert.equal(done.status,200);h.apply(done)
  assert.equal(h.jar.get(sessionName),active)
})

test('scope mismatch fails before network and a delayed old logout cannot clear the next account', async () => {
  let release;const held = new Promise(resolve=>{release=resolve})
  const h=bridge(call=>call.path==='auth/logout'?held:payload({provider:{id:42}}))
  h.jar.set(sessionName,h.session.sealSession({token:'account-a',expires:Date.now()+60000},scopeA))
  const work=h.request('auth/logout','POST',{})
  await new Promise(resolve=>setTimeout(resolve,0))
  h.jar.set('cozy-provider-scope',scopeB)
  const nextName=`cozy-provider.${scopeB}`, next=h.session.sealSession({token:'account-b',expires:Date.now()+60000},scopeB);h.jar.set(nextName,next)
  const count=h.calls.length
  assert.equal((await h.request('me','GET',undefined,scopeA)).status,409)
  assert.equal(h.calls.length,count)
  release(payload({}));const old=await work;assert.equal(old.status,200);h.apply(old)
  assert.equal(h.jar.get(nextName),next)
  assert.equal(old.written.some(c=>c.name===nextName),false)
})

test('verification for the wrong account never installs a session; unavailable email status stays truthful', async () => {
  const h=bridge(call=>call.path==='auth/login'?payload(check('email','unavailable')):payload(verified(true,'other@example.test')))
  const first=await start(h);assert.equal((await first.json()).email_delivery,'unavailable')
  const result=await action(h,'verify',{code:'123456'});assert.equal(result.status,502);assert.equal(h.jar.has(sessionName),false)
})

test('security rate limits preserve bounded Retry-After and cancellation revokes only the provisional credential', async () => {
  let rate=true
  const h=bridge(call=>{
    if(call.path==='auth/login')return payload(check())
    if(call.path==='auth/challenge/verify')return rate?Response.json({message:'Wait before retrying.'},{status:429,headers:{'retry-after':'120'}}):payload(verified())
    if(call.path==='auth/logout'){assert.equal(call.headers.get('authorization'),'Bearer provisional-access');return payload({})}
    throw Error('Unexpected request')
  })
  await start(h)
  const limited=await action(h,'verify',{code:'123456'});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'120')
  rate=false;await verify(h)
  const cancelled=await action(h,'cancel');assert.equal(cancelled.status,200);h.apply(cancelled)
  assert.equal(h.jar.has(pendingName),false);assert.equal(h.jar.has(sessionName),false)
})
test('an expired or corrupted check can be cancelled without touching an active account or making requests', async () => {
 const h=bridge(()=>{throw Error('No request should be sent')})
 const active=h.session.sealSession({token:'existing-owner',expires:Date.now()+60000},scopeA);h.jar.set(sessionName,active)
 h.jar.set(pendingName,h.session.sealValue({stage:'challenge',settings:false,email:'provider@example.test',expires:Date.now()-1000},`provider-protection:${scopeA}`))
 assert.equal((await h.request('auth/protection')).status,404)
 const done=await action(h,'cancel');assert.equal(done.status,200);h.apply(done)
 assert.equal(h.jar.has(pendingName),false);assert.equal(h.jar.get(sessionName),active);assert.equal(h.calls.length,0)
})

test('duplicate enrollment questions are rejected without consuming the ticket or preventing correction', async () => {
 let enrolled=false,saves=0
 const h=bridge(call=>{
  if(call.path==='auth/login')return payload(check())
  if(call.path==='auth/challenge/verify')return payload(verified())
  if(call.path==='auth/security'&&call.method==='GET')return payload(prefs(enrolled))
  if(call.path==='auth/security'&&call.method==='PUT'){saves++;enrolled=true;return payload(prefs(true))}
  throw Error('Unexpected request')
 })
 await start(h);await verify(h)
 assert.equal((await action(h,'save',{method:'questions',questions:['place','place','book'].map(id=>({id,answer:'private answer'}))})).status,422)
 assert.equal(saves,0)
 assert.equal((await action(h,'save',{method:'questions',questions:['place','book','word'].map(id=>({id,answer:'private answer'}))})).status,200)
 assert.equal(saves,1);assert.equal(h.jar.has(sessionName),false)
})

test('a delayed old refresh writes only its own cookie and carries only its own device proof', async () => {
 let release,entered;const renewal=new Promise(resolve=>{release=resolve}),began=new Promise(resolve=>{entered=resolve})
 const h=bridge(call=>{
  if(call.path==='me')return call.headers.get('authorization')==='Bearer renewed-a'?payload({provider:{id:42}}):Response.json({message:'Expired.'},{status:401})
  if(call.path==='auth/refresh'){assert.equal(call.body.device_proof,'f'.repeat(64));entered();return renewal}
  throw Error('Unexpected request')
 })
 h.jar.set(sessionName,h.session.sealSession({token:'account-a',refreshToken:'refresh-a',deviceProof:'f'.repeat(64),email:'provider@example.test',expires:Date.now()+60000},scopeA))
 const work=h.request('me');await began
 const nextName=`cozy-provider.${scopeB}`,next=h.session.sealSession({token:'account-b',expires:Date.now()+60000},scopeB);h.jar.set('cozy-provider-scope',scopeB);h.jar.set(nextName,next)
 release(payload({token:'renewed-a',refresh_token:'renewed-refresh-a'}));const response=await work;assert.equal(response.status,200);h.apply(response)
 assert.equal(h.jar.get(nextName),next)
 assert.equal(h.session.openSession(h.jar.get(sessionName),scopeA).token,'renewed-a')
 assert.equal(response.written.some(c=>c.name===nextName),false)
})
test('a scoped active session cannot be reused as the destination for a different login',async()=>{
 const h=bridge(()=>{throw Error('No login should be transmitted')});h.jar.set(sessionName,h.session.sealSession({token:'current-account',expires:Date.now()+60000},scopeA))
 const response=await h.request('auth/login','POST',{email:'another@example.test',password:'fixture-password'})
 assert.equal(response.status,409);assert.equal(h.calls.length,0);assert.equal(response.written.length,0)
})
test('a delayed login retires only captured old scopes and preserves a newer account cookie',async()=>{
 let release,entered;const held=new Promise(resolve=>{release=resolve}),began=new Promise(resolve=>{entered=resolve})
 const h=bridge(()=>{entered();return held})
 const oldName='cozy-provider.'+'9'.repeat(64);h.jar.set(oldName,'old encrypted cookie')
 const work=h.request('auth/login','POST',{email:'provider@example.test',password:'fixture-password'});await began
 h.jar.set('cozy-provider-scope',scopeB);const nextName='cozy-provider.'+scopeB;h.jar.set(nextName,'new encrypted cookie')
 release(payload(check()));const result=await work;assert.equal(result.status,200);h.apply(result)
 assert.equal(h.jar.has(oldName),false);assert.equal(h.jar.get(nextName),'new encrypted cookie')
 assert.equal(h.jar.get('cozy-provider-scope'),scopeB)
})