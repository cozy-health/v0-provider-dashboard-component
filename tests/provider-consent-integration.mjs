// Real provider UI against synthetic local fixtures only; no deployed API or inbox.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { createIsolatedTestApp } from './isolated-next-app.mjs'
import { sealSession, SESSION_COOKIE } from '../lib/provider-session.ts'
const provider = { id: 42, name: 'Fixture Provider', email: 'provider@example.test', practice: null, timezone: 'UTC', is_verified: false }
let mode = 'failure', privateCalls = 0, records = []
function configuration() {
  const version = mode === 'server-required' ? '2.0' : mode === 'nonblocking-update' ? '1.1' : '1.0'
  return { enforce_blocking: !['disabled','server-required','nonblocking-update'].includes(mode), documents_ready: mode !== 'unavailable', documents: mode === 'empty' || mode === 'disabled' ? {} : Object.fromEntries(['tos', 'privacy_policy'].map(type => [type, { title: type === 'tos' ? 'Provider Terms of Service' : 'Provider Privacy Policy', version, required: true, published: mode !== 'unavailable', content: mode === 'unavailable' ? null : 'Approved synthetic ' + type + ' document.' }])) }
}
const backend = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname.replace('/api/v1/provider/', '')
  const chunks = []; for await (const chunk of req) chunks.push(chunk)
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}
  const send = (data, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)) }
  if (req.headers.authorization !== 'Bearer fictional-consent-token') return send({}, 401)
  if (path === 'me') return send({ data: { provider } })
  if (path === 'consent-config') return mode === 'failure' ? send({message:'Synthetic outage'},503) : send({consent:configuration()})
  if (path === 'me/consents') {
    if (mode === 'disabled' || mode === 'history-outage') return send({message:'Synthetic history outage'},503)
    if (req.method === 'POST') {
      assert.equal(body.actor_id, provider.id)
      const record = {...body,status:body.pre_acceptance ? 'pre_acceptance' : 'accepted'}
      records = [...records.filter(row => row.document_type !== record.document_type || row.version !== record.version),record]
      return send({owner_id:provider.id,data:record})
    }
    return send({owner_id:mode === 'wrong-owner' ? 43 : provider.id,data:mode === 'malformed-history' ? [null] : records})
  }
  if (path === 'clients') { privateCalls++; return send([{user_id:10,name:'SENSITIVE PATIENT FIXTURE',linked_at:'2026-10-01T10:00:00Z',consent_flags:{moods:true,journals:false,quizzes:false,notes:false}}]) }
  if (path === 'resources') {
    if (mode === 'server-required' && !['tos','privacy_policy'].every(type => records.some(row => row.document_type === type && row.version === '2.0' && row.status === 'accepted'))) return send({code:'consent_required',message:'Review required documents.'},403)
    return send({data:[],current_page:1,last_page:1,total:0})
  }
  if (path === 'auth/logout') return send({})
  return send({message:'Unexpected synthetic endpoint'},404)
})
await new Promise(resolve => backend.listen(0,'127.0.0.1',resolve))
process.env.PROVIDER_API_URL = 'http://127.0.0.1:' + backend.address().port + '/api/v1/provider/'
process.env.PROVIDER_SESSION_SECRET = 'c'.repeat(64)
const app = await createIsolatedTestApp('provider-consent')
let server,browser,failed=false
const sockets = new Set()
try {
  await app.prepare()
  server = createServer(app.getRequestHandler()); server.on('upgrade',app.getUpgradeHandler())
  server.on('connection',socket => { sockets.add(socket); socket.on('close',()=>sockets.delete(socket)) })
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  process.env.PROVIDER_DASHBOARD_ORIGIN = origin
  const {chromium} = await import(pathToFileURL(process.env.PROVIDER_PLAYWRIGHT_PATH).href)
  browser = await chromium.launch({headless:true,...(process.env.PROVIDER_CHROMIUM_PATH ? {executablePath:process.env.PROVIDER_CHROMIUM_PATH} : {})})
  const context = await browser.newContext({viewport:{width:390,height:844}})
  await context.addCookies([{name:SESSION_COOKIE,value:sealSession({token:'fictional-consent-token',expires:Date.now()+600000}),url:origin}])
  const page = await context.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message)); page.setDefaultTimeout(60000)
  await page.goto(origin)
  await page.waitForFunction(()=>document.body.textContent.includes('SENSITIVE PATIENT FIXTURE') || [...document.querySelectorAll('button')].some(button=>button.textContent==='Try again'))
  assert.equal(await page.getByRole('heading',{name:/SENSITIVE PATIENT FIXTURE/}).count(),0,'Consent failure must not render private patient data')
  assert.equal(privateCalls,0,'Do not mount private requests before consent is known')
  mode='published'
  await page.getByRole('button',{name:'Try again',exact:true}).click()
  await page.getByRole('dialog',{name:'Provider Terms of Service'}).waitFor()
  assert.equal(privateCalls,0)
  await page.getByRole('button',{name:'Accept',exact:true}).click()
  await page.getByRole('dialog',{name:'Provider Privacy Policy'}).waitFor()
  await page.getByRole('button',{name:'Accept',exact:true}).click()
  await page.getByRole('heading',{name:/SENSITIVE PATIENT FIXTURE/}).waitFor()
  await page.getByRole('textbox',{name:'Search patients',exact:true}).fill('SENSITIVE')
  mode='history-outage'
  const failedRefresh=page.waitForResponse(response=>response.url().endsWith('/api/provider/me/consents') && response.status()===503)
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))
  await failedRefresh
  assert.equal(await page.getByRole('textbox',{name:'Search patients',exact:true}).count(),1,'A same-account refresh must preserve the confirmed workspace')
  assert.equal(await page.getByRole('textbox',{name:'Search patients',exact:true}).inputValue(),'SENSITIVE','Do not discard same-account unsaved state during a network refresh')
  mode='wrong-owner'
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))
  await page.getByRole('button',{name:'Try again',exact:true}).waitFor()
  assert.equal(await page.getByRole('heading',{name:/SENSITIVE PATIENT FIXTURE/}).count(),0,'A mismatched owner must invalidate even a previously confirmed workspace')
  mode='published'
  await page.getByRole('button',{name:'Try again',exact:true}).click()
  await page.getByRole('heading',{name:/SENSITIVE PATIENT FIXTURE/}).waitFor()
  const confirmedCalls=privateCalls
  for (const value of ['unavailable','empty','wrong-owner','malformed-history']) {
    mode=value; await page.reload()
    await page.getByRole('button',{name:'Try again',exact:true}).waitFor()
    assert.equal(await page.getByRole('heading',{name:/SENSITIVE PATIENT FIXTURE/}).count(),0)
    assert.equal(privateCalls,confirmedCalls)
    assert.equal(await page.getByRole('button',{name:'Accept',exact:true}).count(),0)
  }
  await mkdir('scratch/provider-consent-review',{recursive:true})
  if (await page.evaluate(()=>document.documentElement.classList.contains('dark'))) await page.getByRole('button',{name:'Switch to light mode',exact:true}).filter({visible:true}).click()
  await page.screenshot({path:'scratch/provider-consent-review/error-light-390.png',fullPage:true})
  async function errorContrast() {
    return page.getByRole('alert').locator('p').first().evaluate(element=>{
      const rgb=value=>(value.match(/[0-9.]+/g)||[]).map(Number)
      const text=rgb(getComputedStyle(element).color)
      let parent=element,background=[]
      while(parent) {
        const channels=rgb(getComputedStyle(parent).backgroundColor)
        if(channels.length===3 || channels[3]===1) { background=channels;break }
        parent=parent.parentElement
      }
      const luminance=channels=>channels.slice(0,3).map(value=>{const s=value/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0)
      const first=luminance(text),second=luminance(background)
      return (Math.max(first,second)+0.05)/(Math.min(first,second)+0.05)
    })
  }
  const lightContrast=await errorContrast()
  console.log('Light error text contrast:',lightContrast)
  assert.ok(lightContrast>=4.5,'Normal error text must meet 4.5:1 contrast in light mode')

  await page.getByRole('button',{name:'Switch to dark mode',exact:true}).filter({visible:true}).click()
  await page.getByRole('button',{name:'Switch to light mode',exact:true}).filter({visible:true}).waitFor()
  await page.setViewportSize({width:320,height:740})
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%'})
  const mobileHeader = page.getByRole('button',{name:'Open navigation',exact:true}).locator('xpath=ancestor::header')
  const brandBounds = await mobileHeader.getByText('Cozy Health',{exact:true}).evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})
  const themeBounds = await mobileHeader.getByRole('button',{name:/Switch to (light|dark) mode/}).boundingBox()
  assert.ok(themeBounds)
  assert.equal(brandBounds.x < themeBounds.x+themeBounds.width && brandBounds.x+brandBounds.width > themeBounds.x && brandBounds.y < themeBounds.y+themeBounds.height && brandBounds.y+brandBounds.height > themeBounds.y,false,'Large-text provider branding must not overlap the theme control')
  await page.screenshot({path:'scratch/provider-consent-review/error-dark-large-text.png',fullPage:true})
  const darkContrast=await errorContrast()
  console.log('Dark error text contrast:',darkContrast)
  assert.ok(darkContrast>=4.5,'Error text must remain readable in dark mode')
  await writeFile('scratch/provider-consent-review/contrast.json',JSON.stringify({lightContrast,darkContrast},null,2))
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  mode='disabled';await page.reload()
  await page.getByRole('heading',{name:/SENSITIVE PATIENT FIXTURE/}).waitFor()
  await page.getByRole('textbox',{name:'Search patients',exact:true}).fill('SENSITIVE')
  mode='nonblocking-update'
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))
  await page.getByRole('button',{name:'Review',exact:true}).waitFor()
  assert.equal(await page.getByRole('textbox',{name:'Search patients',exact:true}).inputValue(),'SENSITIVE','Optional notices must preserve existing workspace input')
  for(let notice=0;notice<2;notice++) {
    await page.getByRole('button',{name:'Dismiss',exact:true}).click()
    assert.equal(await page.getByRole('textbox',{name:'Search patients',exact:true}).inputValue(),'SENSITIVE')
  }
  await page.setViewportSize({width:1280,height:900})
  mode='server-required';await page.reload()
  await page.getByRole('heading',{name:/SENSITIVE PATIENT FIXTURE/}).waitFor()
  await page.getByRole('button',{name:'Resources',exact:true}).click()
  await page.getByRole('dialog',{name:'Provider Terms of Service'}).waitFor()
  await page.getByRole('button',{name:'Accept',exact:true}).click()
  await page.getByRole('dialog',{name:'Provider Privacy Policy'}).waitFor()
  await page.getByRole('button',{name:'Accept',exact:true}).click()
  await page.getByText('Build your resource library',{exact:true}).waitFor()
  assert.deepEqual(errors,[])
  console.log('PASS provider consent: private children withheld, retry, acceptance, unavailable/empty documents, wrong owner, paused rollout, server-required recovery and small dark large-text layout')
} catch(error) { console.error(error);failed=true }
finally { if(browser)await browser.close(); for(const socket of sockets)socket.destroy(); if(server)await new Promise(resolve=>server.close(resolve));await app.close();await new Promise(resolve=>backend.close(resolve)) }
process.exit(failed ? 1 : 0)
