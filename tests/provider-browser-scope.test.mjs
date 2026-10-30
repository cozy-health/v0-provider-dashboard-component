import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { webcrypto } from 'node:crypto'
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}}
function browser(fetcher,csrf=()=>Promise.resolve({})){
 const cache=new Map();let cookie='cozy-provider-scope='+'a'.repeat(64)
 const document={get cookie(){return cookie},set cookie(value){cookie=value.split(';')[0]}}
 const navigations=[]
 const window={dispatchEvent(){},location:{origin:'https://dashboard.example.test',replace(url){navigations.push(url)}}}
 const load=name=>{
  if(cache.has(name))return cache.get(name)
  const exports={};cache.set(name,exports)
  const source=fs.readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8')
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,strict:true,noUncheckedIndexedAccess:true}}).outputText
  vm.runInNewContext(compiled,{exports,document,window,location:{protocol:'https:'},crypto:webcrypto,Event,FormData,Response,Headers,URL,BroadcastChannel:undefined,fetch:fetcher,require(name){if(name==='./csrf')return {mutationHeaders:csrf};if(name==='./provider-auth-scope')return load('provider-auth-scope');throw Error('Unexpected dependency '+name)}})
  return exports
 }
 return {api:load('provider-api'),scope:load('provider-auth-scope'),navigations}
}
test('changing accounts while JSON is parsed rejects the old response even after a new login updates the module scope',async()=>{
 const read=deferred(),entered=deferred()
 const h=browser(async()=>({ok:true,status:200,headers:new Headers(),json(){entered.resolve();return read.promise}}))
 const request=h.api.api('me'),rejected=assert.rejects(request,/account changed/)
 await entered.promise;h.scope.beginBrowserSignIn();read.resolve({data:{provider:{id:42}}});await rejected
})
test('a downloaded report stays bound to the account that requested it',async()=>{
 const h=browser(async()=>new Response('fixture PDF'))
 const response=await h.api.providerFetch('reports/1/pdf')
 h.scope.beginBrowserSignIn()
 assert.throws(()=>h.api.assertProviderResponse(response),/account changed/)
})
test('an account change while CSRF is awaited prevents any old form from being transmitted',async()=>{
 const csrf=deferred(),entered=deferred();let requests=0
 const h=browser(async()=>{requests++;return Response.json({})},()=>{entered.resolve();return csrf.promise})
 const request=h.api.api('clients/42/notes',{method:'POST',body:JSON.stringify({body:'old private draft'})}),rejected=assert.rejects(request,/account changed/)
 await entered.promise;h.scope.beginBrowserSignIn();csrf.resolve({});await rejected;assert.equal(requests,0)
})
test('security denials redirect downloads as well as JSON requests only for their current account',async()=>{
 const h=browser(async()=>Response.json({code:'signin_verification_required',message:'Sign in again.'},{status:403}))
 await h.api.providerFetch('reports/1/pdf')
 assert.equal(h.navigations.length,1);assert.match(h.navigations[0],/\/login\?expired=1$/)
})