// Isolated synthetic server and browser only. No real inboxes, patients or deployed API.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'
import { createIsolatedTestApp } from './isolated-next-app.mjs'
const provider={id:42,name:'Fixture Provider',email:'provider@example.test',practice:null,timezone:'UTC',is_verified:false,license_number:null,license_state:null}
const questions={place:'A memorable secret place?',book:'A memorable secret book?',word:'A memorable secret word?'}
let enrolled=false, method='email', settings=false, privateCalls=0
const backend=createServer(async(req,res)=>{
 try {
  const endpoint=new URL(req.url,'http://localhost').pathname.replace('/api/v1/provider/','')
  const chunks=[];for await(const chunk of req)chunks.push(chunk)
  const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{}
  const send=(data,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data))}
  const challenge=purpose=>({challenge_required:true,challenge_token:'d'.repeat(64),method:purpose==='settings'?'email':enrolled?method:'email',expires_at:new Date(Date.now()+600000).toISOString(),questions:enrolled&&method==='questions'&&purpose!=='settings'?Object.entries(questions).slice(0,2).map(([id,prompt])=>({id,prompt})):[],email_delivery:'queued'})
  if(endpoint==='auth/login'){settings=false;return send({data:challenge('login')})}
  if(endpoint==='auth/challenge/verify'){
   if(body.code!=='123456')return send({message:'The code was not accepted. Please try again.'},422)
   if(settings)return send({data:{verified:true,security_settings_token:'1'.repeat(64)}})
   return send({data:{challenge_required:false,security_enrollment_required:!enrolled,provider,token:'fixture-provisional',refresh_token:'e'.repeat(64),device_proof:'f'.repeat(64),security_settings_token:'1'.repeat(64)}})
  }
  if(endpoint==='auth/security'&&req.method==='GET')return send({data:{enabled:true,enrolled,method,questions}})
  if(endpoint==='auth/security'&&req.method==='PUT'){assert.equal(body.security_settings_token,'1'.repeat(64));enrolled=true;method=body.method;return send({data:{enabled:true,enrolled,method,questions}})}
  if(endpoint==='auth/security/reauthenticate'){assert.equal(body.password,'FixturePassword123');settings=true;return send({data:challenge('settings')})}
  if(endpoint==='auth/logout')return send({data:{}})
  if(['me','clients'].includes(endpoint)){
   privateCalls++;assert.ok(enrolled);assert.equal(req.headers.authorization,'Bearer fixture-provisional')
   return send(endpoint==='me'?{data:{provider}}:[])
  }
  if(endpoint==='consent-config')return send({enforce_blocking:false,documents:{}})
  if(endpoint==='me/consents')return send({data:[]})
  throw Error('Unexpected fixture endpoint '+endpoint)
 }catch(error){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({message:error.message}))}
})
await new Promise(resolve=>backend.listen(0,'127.0.0.1',resolve))
process.env.PROVIDER_API_URL=`http://127.0.0.1:${backend.address().port}/api/v1/provider/`
process.env.PROVIDER_SESSION_SECRET='c'.repeat(64)
const app=await createIsolatedTestApp('provider-protection')
let server,browser,exitCode=0
try{
 await app.prepare();server=createServer(app.getRequestHandler());server.on('upgrade',app.getUpgradeHandler())
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const origin=`http://127.0.0.1:${server.address().port}`;process.env.PROVIDER_DASHBOARD_ORIGIN=origin
 const {chromium}=await import(pathToFileURL(process.env.PROVIDER_PLAYWRIGHT_PATH).href)
 browser=await chromium.launch({headless:true})
 const context=await browser.newContext({viewport:{width:390,height:844}})
 await context.routeWebSocket('**/_next/webpack-hmr**',()=>{})
 const page=await context.newPage(),errors=[]
 page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000)
 await page.goto(origin+'/login');await page.getByLabel('Email',{exact:true}).fill(provider.email);await page.getByLabel('Password',{exact:true}).fill('FixturePassword123');await page.getByRole('button',{name:'Sign in',exact:true}).click()
 await page.getByRole('heading',{name:'Sign-in protection',exact:true}).waitFor()
 assert.equal(privateCalls,0)
 assert.equal((await context.cookies()).some(c=>/^cozy-provider\.[a-f0-9]{64}$/.test(c.name)),false)
 await page.getByLabel('Six-digit email code').fill('000000');await page.getByRole('button',{name:'Verify and continue',exact:true}).click();await page.getByRole('alert').getByText(/code was not accepted/).waitFor()
 assert.equal(await page.getByLabel('Six-digit email code').inputValue(),'')
 await page.reload();await page.getByRole('heading',{name:'Sign-in protection',exact:true}).waitFor()
 await page.getByLabel('Six-digit email code').fill('123456');await page.getByRole('button',{name:'Verify and continue',exact:true}).click()
 await page.getByLabel('Secret answer 1',{exact:true}).waitFor()
 for(let i=1;i<=3;i++)await page.getByLabel('Secret answer '+i,{exact:true}).fill('private fixture answer')
 await mkdir('../docs/validation/provider-protection',{recursive:true})
 await page.screenshot({path:'../docs/validation/provider-protection/enrollment-light.png',fullPage:true})
 await page.getByRole('button',{name:'Save sign-in protection',exact:true}).click();await page.getByRole('button',{name:'Continue with saved protection',exact:true}).waitFor()
 assert.equal(privateCalls,0)
 await page.getByRole('button',{name:'Continue with saved protection',exact:true}).click()
 await page.getByText(/No linked patients yet/).waitFor()
 const cookies=await context.cookies(),scope=cookies.find(c=>c.name==='cozy-provider-scope')?.value
 const session=cookies.find(c=>c.name==='cozy-provider.'+scope)
 assert.ok(session?.httpOnly);assert.ok(session?.value)
 const publicCookie=await page.evaluate(()=>document.cookie)
 for(const secret of ['fixture-provisional','e'.repeat(64),'f'.repeat(64),'private fixture answer'])assert.equal(publicCookie.includes(secret),false)
 await page.goto(origin+'/provider/security')
 await page.getByRole('button',{name:'Confirm identity',exact:true}).click()
 const dialog=page.getByRole('dialog');await dialog.waitFor()
 const box=await dialog.boundingBox();assert.ok(box);assert.ok(Math.abs(box.x+box.width/2-195)<3)
 await page.screenshot({path:'../docs/validation/provider-protection/identity-centered-light.png',fullPage:true})
 await page.getByLabel('Current password',{exact:true}).fill('FixturePassword123');await page.getByRole('button',{name:'Send verification code',exact:true}).click()
 await page.getByLabel('Six-digit email code').fill('123456');await page.getByRole('button',{name:'Verify and continue',exact:true}).click()
 await page.getByRole('button',{name:'Email code',exact:true}).click();await page.getByRole('button',{name:'Save sign-in protection',exact:true}).click();await page.getByRole('button',{name:'Continue with saved protection',exact:true}).click()
 await page.getByText(/No linked patients yet/).waitFor();assert.equal(method,'email')
 assert.equal((await context.cookies()).find(c=>c.name===session.name)?.value,session.value)
 await page.goto(origin+'/provider/security');await page.getByRole('button',{name:'Confirm identity',exact:true}).waitFor()
 await page.setViewportSize({width:320,height:740});await page.emulateMedia({colorScheme:'dark'})
 await page.evaluate(()=>{document.documentElement.style.fontSize='200%'})
 await page.getByRole('button',{name:'Confirm identity',exact:true}).click();await dialog.waitFor()
 await page.screenshot({path:'../docs/validation/provider-protection/identity-dark-320-large-text.png',fullPage:false,animations:'disabled'})
 const layout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,overflow:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1&&r.width>0}).slice(0,12).map(el=>({tag:el.tagName,classes:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))}))
 if(layout.width>layout.viewport)console.log('Large-text layout diagnostics',JSON.stringify(layout))
 assert.equal(layout.width<=layout.viewport,true)
 await dialog.getByRole('button',{name:'Send verification code',exact:true}).scrollIntoViewIfNeeded()
 const actionBox=await dialog.getByRole('button',{name:'Send verification code',exact:true}).boundingBox()
 assert.ok(actionBox && actionBox.x>=0 && actionBox.x+actionBox.width<=320 && actionBox.y>=0 && actionBox.y+actionBox.height<=740)
 await page.screenshot({path:'../docs/validation/provider-protection/identity-dark-320-large-text-actions.png',fullPage:false,animations:'disabled'})
 await page.getByLabel('Current password',{exact:true}).fill('not-for-another-account')
 const second=await context.newPage();await second.goto(origin+'/login');await second.getByRole('heading',{name:'Sign-in protection',exact:true}).waitFor();await second.getByRole('button',{name:'Start sign-in again',exact:true}).click();await second.getByRole('heading',{name:'Provider sign in',exact:true}).waitFor();await second.getByLabel('Email',{exact:true}).fill('another@example.test');await second.getByLabel('Password',{exact:true}).fill('FixturePassword123');await second.getByRole('button',{name:'Sign in',exact:true}).click()
 await second.getByRole('heading',{name:'Sign-in protection',exact:true}).waitFor()
 await page.getByText(/If you changed accounts/).waitFor();assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.locator('input[type="password"]').count(),0)
 assert.deepEqual(errors,[])
 console.log('PASS provider protection browser: pending reload, wrong-code recovery, enrollment before private content, centered identity, settings email proof, unchanged active session, dark 320px/200% text, cross-tab account switch and secret cleanup. Synthetic fixtures only; no real email delivery.')
}catch(error){exitCode=1;console.error(error)}finally{
 await browser?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
 await Promise.race([app.close(),new Promise(resolve=>setTimeout(resolve,5000))]);backend.closeAllConnections();await new Promise(resolve=>backend.close(resolve))
}
process.exit(exitCode)