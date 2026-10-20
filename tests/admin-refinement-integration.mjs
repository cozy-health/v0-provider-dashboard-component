import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const origin='http://localhost:3000'
const { chromium }=await import(pathToFileURL(process.env.ADMIN_PLAYWRIGHT_PATH).href)
const browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true})
const page=await context.newPage(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
const shots='docs/validation/admin-refinement';await mkdir(shots,{recursive:true})
async function json(path){const r=await page.request.get(origin+'/api/admin/'+path);assert.equal(r.status(),200,path);return r.json()}
try {
 await page.goto(origin+'/admin/login')
 await page.getByLabel('Email',{exact:true}).fill('admin@cozy.local');await page.getByLabel('Password',{exact:true}).fill('CozyLocal!Review2026');await page.getByRole('button',{name:'Sign in',exact:true}).click()
 await page.getByRole('heading',{name:'User registrations',exact:true}).waitFor()
 await page.getByRole('heading',{name:'Needs attention',exact:true}).waitFor()
 assert.ok((await page.getByRole('heading',{name:'User registrations',exact:true}).boundingBox()).y<(await page.getByRole('heading',{name:'Needs attention',exact:true}).boundingBox()).y)
 assert.equal(await page.getByRole('navigation',{name:'Admin navigation'}).getByRole('link',{name:'Usage',exact:true}).count(),0)
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download UTC date Registrations CSV',exact:true}).click();const download=await downloadPromise
 const csv=await readFile(await download.path(),'utf8');assert.ok(csv.includes('"release"'));assert.ok(csv.includes('"UTC date","Registrations"'));assert.ok(!csv.includes('example.test'))
 const operation=await json('operations/summary');assert.ok(operation.data.queue)
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({animations:'disabled',path:shots+'/overview-light.png',fullPage:true})
 const report=(await json('reports?per_page=10')).data.data[0];assert.ok(report)
 // An exact review is independent of the list's selected page and filters.
 await page.goto(origin+`/admin/manage/reports?status=pending&page=3&record=${report.id}`)
 await page.getByRole('heading',{name:'Review reported content',exact:true}).waitFor()
 assert.ok((await page.getByRole('dialog').innerText()).includes('#'+report.id))
 await page.screenshot({animations:'disabled',path:shots+'/direct-report.png',fullPage:true})
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForURL(url=>!url.searchParams.has('record'))
 assert.equal(new URL(page.url()).searchParams.get('page'),'3');assert.equal(new URL(page.url()).searchParams.get('status'),'pending');assert.equal(new URL(page.url()).searchParams.has('record'),false)
 await page.getByRole('button',{name:'Overdue reports',exact:true}).click();await page.waitForURL('**/admin/manage/reports?**overdue=1*')
 assert.equal(new URL(page.url()).searchParams.get('status'),'pending')
 await page.goto(origin+'/admin/manage/reports');await page.waitForURL('**overdue=1*')
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cozy-admin-filters:v1:reports')));assert.deepEqual(Object.keys(saved).sort(),['overdue','status'])
 const support=(await json('support?status=open')).data.data[0];assert.ok(support)
 await page.goto(origin+`/admin/manage/support?status=open&page=2&record=${support.id}`)
 await page.getByRole('heading',{name:'Edit Support Reports',exact:true}).waitFor();assert.equal(await page.getByLabel('Admin notes',{exact:true}).inputValue(),support.admin_notes||'')
 const concurrent = await page.evaluate(async ({ id, status }) => { const csrf=await fetch('/api/csrf').then(r=>r.json());const r=await fetch('/api/admin/support/'+id,{method:'PUT',headers:{'Content-Type':'application/json','X-Cozy-Request':'1','X-CSRF-Token':csrf.token},body:JSON.stringify({status,admin_notes:'Concurrent local test note'})});return r.status }, {id:support.id,status:support.status})
 assert.equal(concurrent,200)
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('dialog').getByText('This record has changed. Reload it and retry.',{exact:true}).waitFor()
 await page.getByRole('dialog').getByRole('button',{name:'Reload record',exact:true}).click();await page.getByLabel('Admin notes',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Admin notes"]')?.value==='Concurrent local test note')
 await page.getByLabel('Admin notes',{exact:true}).fill(support.admin_notes||'')
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForURL(url=>!url.searchParams.has('record'));assert.equal(new URL(page.url()).searchParams.get('page'),'2')
 await page.goto(origin+'/admin/manage/support?record=99999999');await page.getByText('This record is no longer available.',{exact:true}).waitFor();await page.getByRole('button',{name:'Return to list',exact:true}).click()
 await page.goto(origin+'/admin/retention');await page.getByRole('tab',{name:'Retention',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('tab'),'retention');await page.getByRole('heading',{name:'Signup cohort retention',exact:true}).waitFor()
 await page.goto(origin+'/admin/usage');await page.getByRole('heading',{name:'Feature usage',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/admin/datacenter')
 await page.getByRole('tab',{name:'Wellness',exact:true}).click();await page.getByRole('heading',{name:'Mood distribution'}).waitFor();await page.screenshot({animations:'disabled',path:shots+'/wellness-light.png',fullPage:true})
 await page.getByRole('tab',{name:'Retention',exact:true}).click();await page.getByRole('heading',{name:'Signup cohort retention'}).waitFor()
 await page.screenshot({animations:'disabled',path:shots+'/retention-light.png',fullPage:true})
 await page.goto(origin+'/admin');await page.getByRole('heading',{name:'Needs attention'}).waitFor();await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click()
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({animations:'disabled',path:shots+'/overview-dark.png',fullPage:true})
 for(const width of [768,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({animations:'disabled',path:shots+`/overview-${width}.png`,fullPage:true})}
 await page.goto(origin+'/admin/datacenter?tab=retention');await page.getByRole('heading',{name:'Signup cohort retention'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 assert.deepEqual(errors,[])
 console.log('PASS local refinement: chart hierarchy, aggregate CSV, exact review outside pagination, preserved/remembered filters, missing records, legacy redirects, retention, themes and responsive layouts.')
}catch(e){await page.screenshot({animations:'disabled',path:shots+'/failure.png',fullPage:true}).catch(()=>{});throw e}finally{await browser.close()}
