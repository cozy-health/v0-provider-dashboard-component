import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

// Run against the isolated local preview. Only authentication reaches the API;
// management writes below are intercepted synthetic fixtures.
const origin = 'http://localhost:3000'
const { chromium } = await import(pathToFileURL(process.env.ADMIN_PLAYWRIGHT_PATH).href)
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(20000)
const errors = [], writes = []
page.on('pageerror', error => errors.push(error.message))
const id = '12345678-1234-1234-1234-123456789abc'
const oldVersion = 'a'.repeat(64), newVersion = 'b'.repeat(64)
const definition = { title: 'Archived reflection', slug: 'archived-reflection', type: 'wellness', description: 'A synthetic assessment.', estimated_minutes: 2, disclaimer: 'Reflection only.', scoring_rules: { timeframe: 'Today', bands: [{ max: 1, label: 'Reflection', recommendation: 'Rest' }] }, questions: [{ question: 'Support today?', options: [{ label: 'Some', score: 0 }, { label: 'More', score: 1 }] }] }
let content = { id, body: 'Original anonymous comment', status: 'published', is_anonymous: true, created_at: '2026-10-01 12:00:00', updated_at: '2026-10-01 12:00:00', version: oldVersion }
let report = { id: 91, target_type: 'comment', reason: 'safety', status: 'pending', created_at: '2026-10-01 12:00:00', due_at: '2026-10-02 12:00:00', resolved_at: null, target: { ...content, status: 'removed' } }
const rows = data => ({ data: { data, current_page: 1, last_page: 1, total: data.length } })
const shots = 'docs/validation/admin-review-safety'

try {
  await page.goto(origin + '/admin/login')
  await page.getByLabel('Email', { exact: true }).fill('admin@cozy.local')
  await page.getByLabel('Password', { exact: true }).fill('CozyLocal!Review2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor()

  await page.route('**/api/admin/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname.replace('/api/admin/', '')
    const method = route.request().method()
    const send = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (method !== 'GET') {
      const body = route.request().postDataJSON(); writes.push({ path, body })
      if (path === 'community/comments/' + id) {
        if (body.expected_version === oldVersion) return send({ message: 'This record has changed. Reload it and retry.' }, 409)
        assert.equal(body.expected_version, newVersion); assert.equal(body.confirm_republish, true)
        content.status = body.status
        return send({ message: 'Saved.' })
      }
      if (path === 'reports/91') {
        if (body.expected_version === oldVersion) return send({ message: 'This record has changed. Reload it and retry.' }, 409)
        assert.equal(body.expected_version, newVersion); assert.equal(body.confirm_republish, true)
        report.status = 'resolved'; report.resolved_at = '2026-10-16 12:00:00'; report.target.status = 'published'
        return send({ message: 'Saved.' })
      }
      if (path === 'content/communities') return send({ errors: { description: ['The description field is required.'] } }, 422)
      throw new Error('Unexpected management write: ' + path)
    }
    if (path === 'users') return send(rows([{ id: 1, name: 'Synthetic person', email: 'person@example.test', is_active: true, email_verified_at: null, created_at: '2026-10-01 12:00:00' }]))
    if (path === 'quizzes') return send(rows([{ id: 1, title: definition.title, status: 'archived', definition }]))
    if (path === 'community/comments') return send(rows([content]))
    if (path === 'community/comments/' + id) return send({ data: content })
    if (path === 'reports') return send(rows([report]))
    if (path === 'reports/91') return send({ data: report })
    if (path === 'content/communities' || path === 'content/challenges') return send(rows([]))
    return route.continue()
  })

  await page.goto(origin + '/admin/manage/users')
  await page.getByRole('button', { name: 'View', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('heading', { name: 'View Users', exact: true }).waitFor()
  assert.equal(await dialog.locator('input,textarea,select').count(), 0)
  for (const name of ['Edit', 'Delete', 'Save']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0)
  for (const label of ['Account status', 'Email verification', 'Registered']) assert.ok((await dialog.innerText()).includes(label))
  await page.keyboard.press('Escape')
  console.log('PASS view-only users')

  await page.goto(origin + '/admin/manage/quizzes')
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await dialog.getByRole('heading', { name: definition.title, exact: true }).waitFor()
  await dialog.getByRole('heading', { name: 'Scoring overview', exact: true }).waitFor()
  for (const name of ['Save draft', 'Publish', 'Archive', 'Edit questions']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0)
  assert.equal(await dialog.locator('input:not([disabled]),textarea,select').count(), 0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Create Quiz', exact: true }).click()
  const upload = page.locator('input[type=file]')
  const malformed = { ...definition, scoring_rules: { timeframe: 'Today', bands: [null] } }
  await upload.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malformed)) })
  await dialog.getByRole('alert').filter({ hasText: 'Scoring band 1 must be an object' }).waitFor()
  assert.equal(await dialog.getByLabel('title', { exact: true }).inputValue(), 'Daily wellbeing check')
  await upload.setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(definition)) })
  await dialog.getByRole('heading', { name: definition.title, exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Edit questions', exact: true }).click()
  assert.equal(await dialog.getByLabel('title', { exact: true }).inputValue(), definition.title)
  await page.keyboard.press('Escape')
  console.log('PASS archived quizzes and safe imports')

  for (const moduleKey of ['communities', 'challenges']) {
    await page.goto(origin + '/admin/manage/' + moduleKey)
    await page.getByRole('button', { name: moduleKey === 'communities' ? 'Create Community' : 'Create Challenge', exact: true }).click()
    assert.equal(await dialog.getByLabel('Description', { exact: true }).getAttribute('required'), '')
    if (moduleKey === 'communities') {
      await dialog.getByLabel('Name', { exact: true }).fill('Fixture')
      await dialog.getByLabel('Description', { exact: true }).fill('   ')
      await dialog.getByRole('button', { name: 'Save', exact: true }).click()
      await dialog.locator('#error-description').getByText('The description field is required.', { exact: true }).waitFor()
      assert.equal(await dialog.getByLabel('Description', { exact: true }).getAttribute('aria-invalid'), 'true')
    }
    await page.keyboard.press('Escape')
  }
  console.log('PASS required descriptions and field errors')

  await page.goto(origin + '/admin/manage/comments')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  content = { ...content, body: 'Newer anonymous comment', status: 'removed', version: newVersion }
  await dialog.getByLabel('Status', { exact: true }).selectOption('removed')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await dialog.getByRole('button', { name: 'Reload content', exact: true }).waitFor()
  assert.equal(await dialog.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true)
  await dialog.getByRole('button', { name: 'Reload content', exact: true }).click()
  await dialog.getByText('Newer anonymous comment', { exact: true }).waitFor()
  assert.equal(await dialog.getByLabel('Status', { exact: true }).inputValue(), 'removed')
  await dialog.getByLabel('Status', { exact: true }).selectOption('published')
  page.once('dialog', prompt => prompt.dismiss())
  const beforeCancel = writes.length
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  assert.equal(writes.length, beforeCancel)
  page.once('dialog', prompt => prompt.accept())
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  console.log('PASS stale direct moderation and explicit republishing')

  await page.goto(origin + '/admin/manage/reports?record=91')
  await dialog.getByRole('heading', { name: 'Review reported content', exact: true }).waitFor()
  for (const label of ['Reason', 'safety', 'Overdue', 'Content status', 'removed', 'Submitted', 'Deadline', 'Content updated']) assert.ok((await dialog.innerText()).includes(label))
  report.target = { ...report.target, body: 'Content changed during report review', version: newVersion }
  page.once('dialog', prompt => prompt.accept())
  await dialog.getByRole('button', { name: 'publish', exact: true }).click()
  await dialog.getByRole('button', { name: 'Reload record', exact: true }).click()
  await dialog.getByText('Content changed during report review', { exact: true }).waitFor()
  await mkdir(shots, { recursive: true })
  await page.screenshot({ path: shots + '/report-context.png', fullPage: true })
  page.once('dialog', prompt => prompt.accept())
  await dialog.getByRole('button', { name: 'publish', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  await page.goto(origin + '/admin/manage/reports?record=91')
  await dialog.getByText('resolved', { exact: true }).waitFor()
  for (const name of ['publish', 'remove', 'dismiss']) assert.equal(await dialog.getByRole('button', { name, exact: true }).count(), 0)
  await page.keyboard.press('Escape')
  report = { ...report, status: 'pending', resolved_at: null, target: null }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin + '/admin/manage/reports?record=91')
  await dialog.getByRole('button', { name: 'dismiss', exact: true }).waitFor()
  assert.equal(await dialog.getByRole('button', { name: 'publish', exact: true }).count(), 0)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: shots + '/missing-content-mobile.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS report context, conflict reload, resolved/missing content, mobile layout; no runtime errors')
} finally { await browser.close() }
