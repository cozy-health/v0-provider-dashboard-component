// Runs the real dashboard against isolated, fictional local API fixtures.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createIsolatedTestApp } from './isolated-next-app.mjs'
import { sealSession, SESSION_COOKIE } from '../lib/provider-session.ts'

const shareId = '22222222-2222-4222-8222-222222222222'
let withdrawn = false, unavailable = false, reads = 0
const provider = { id: 1, name: 'Fixture Provider', email: 'provider@example.test', practice: 'Fictional test practice', timezone: 'UTC', is_verified: true }
const backend = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname.replace('/api/v1/provider/', '')
  res.setHeader('Content-Type', 'application/json')
  const send = (data, status=200) => { res.writeHead(status); res.end(JSON.stringify(data)) }
  if (req.headers.authorization !== 'Bearer fictional-journal-test-token') return send({},401)
  if (path === 'me') return send({ data: { provider } })
  if (path === 'consent-config') return send({consent:{enforce_blocking:false,documents:{}}})
  if (path === 'me/consents') return send({consents:[]})
  if (path === 'clients') return send({data:[],last_page:1,total:0})
  if (path === 'conversations') return send([{id:7,name:'Fictional Patient',user_id:10,unread:0}])
  if (path === 'conversations/7/read') return send({})
  if (path === 'conversations/7/messages') return send({data:[{id:1,sender:'patient',content:'',records:[{type:'journal_shares',id:shareId,data:{requires_online_review:true}}],created_at:'2026-10-25T12:00:00Z'}],has_more:false})
  if (path === `conversations/7/journal-shares/${shareId}`) {
    reads++
    if (withdrawn) return send({},404)
    if (unavailable) return send({},500)
    res.setHeader('Cache-Control','private, no-store')
    return send({share_id:shareId,entry:{title:'Fictional reflection',body:'FICTIONAL SHARED COPY — later edits stay private.'},shared_at:'2026-10-25T12:00:00Z',later_edits_shared:false})
  }
  return send({},404)
})
await new Promise(resolve=>backend.listen(0,'127.0.0.1',resolve))
process.env.NODE_ENV='development'
process.env.COZY_DEPLOYMENT_ENV='development'
process.env.PROVIDER_API_URL=`http://127.0.0.1:${backend.address().port}/api/v1/provider/`
process.env.PROVIDER_SESSION_SECRET=randomBytes(32).toString('hex')
const app=await createIsolatedTestApp('journal-sharing')
let server,browser
const sockets=new Set()
let failed=false
try {
  assert.ok(process.env.PROVIDER_PLAYWRIGHT_PATH,'Provide the existing Playwright module path')
  await app.prepare()
  server=createServer(app.getRequestHandler())
  server.on('upgrade',app.getUpgradeHandler())
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket))})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const origin=`http://127.0.0.1:${server.address().port}`
  process.env.PROVIDER_DASHBOARD_ORIGIN=origin
  const {chromium}=await import(pathToFileURL(process.env.PROVIDER_PLAYWRIGHT_PATH).href)
  browser=await chromium.launch({headless:true,...(process.env.PROVIDER_CHROMIUM_PATH?{executablePath:process.env.PROVIDER_CHROMIUM_PATH}:{})})
  const context=await browser.newContext({viewport:{width:1280,height:900}})
  await context.addCookies([{name:SESSION_COOKIE,value:sealSession({token:'fictional-journal-test-token',expires:Date.now()+600000}),url:origin}])
  const page=await context.newPage()
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(origin)
  await page.getByRole('button',{name:'Messages',exact:true}).click()
  await page.getByRole('button',{name:'Review shared journal copy',exact:true}).waitFor()
  assert.equal(reads,0,'Do not fetch written copies before explicit review')
  assert.equal(await page.getByText(/FICTIONAL SHARED COPY/).count(),0)
  await mkdir('scratch/journal-sharing-review',{recursive:true})
  for (const theme of ['light','dark']) {
    const isDark=await page.evaluate(()=>document.documentElement.classList.contains('dark'))
    if(isDark!==(theme==='dark')) await page.getByRole('button',{name:isDark?'Switch to light mode':'Switch to dark mode',exact:true}).filter({visible:true}).click()
    await page.getByRole('button',{name:'Review shared journal copy',exact:true}).click()
    await page.getByText(/FICTIONAL SHARED COPY/).waitFor()
    await page.screenshot({path:`scratch/journal-sharing-review/${theme}.png`,fullPage:true})
    await page.getByRole('button',{name:'Close',exact:true}).click()
    assert.equal(await page.getByText(/FICTIONAL SHARED COPY/).count(),0)
  }
  await page.setViewportSize({width:320,height:568})
  await page.getByRole('button',{name:'Review shared journal copy',exact:true}).click()
  await page.getByText(/FICTIONAL SHARED COPY/).waitFor()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.screenshot({path:'scratch/journal-sharing-review/small-phone.png',fullPage:true})
  withdrawn=true
  await page.getByRole('button',{name:'Refresh copy',exact:true}).click()
  await page.getByRole('alert').filter({hasText:'could not be opened'}).waitFor()
  assert.equal(await page.getByText(/FICTIONAL SHARED COPY/).count(),0,'Withdrawal must remove previously loaded text')
  withdrawn=false;unavailable=true
  await page.getByRole('button',{name:'Refresh copy',exact:true}).click()
  await page.getByRole('alert').filter({hasText:'could not be opened'}).waitFor()
  assert.equal(await page.getByText(/FICTIONAL SHARED COPY/).count(),0)
  unavailable=false
  await page.getByRole('button',{name:'Refresh copy',exact:true}).click()
  await page.getByText(/FICTIONAL SHARED COPY/).waitFor()
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
  await page.getByRole('dialog').waitFor({state:'hidden'})
  assert.equal(await page.getByText(/FICTIONAL SHARED COPY/).count(),0)
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(k=>/journal|share/i.test(k))),[])
  assert.deepEqual(errors,[])
  console.log('PASS: explicit online review, both themes, small phone, close/blur cleanup, withdrawal, failure/retry and no persisted journal text. Only local fictional fixtures used.')
} catch(error) { failed=true; console.error(error) }
finally {
  await browser?.close()
  for(const socket of sockets) socket.destroy()
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
  await Promise.race([app.close(),new Promise(resolve=>setTimeout(resolve,5000))])
  backend.closeAllConnections();await new Promise(resolve=>backend.close(resolve))
}
process.exit(failed?1:0)
