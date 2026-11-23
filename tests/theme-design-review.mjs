import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

export async function themeControl(page) {
  return page.getByRole('button', { name: 'Appearance and layout', exact: true }).filter({visible:true})
    .or(page.getByRole('button', { name: /Switch to (light|dark) mode/ }).filter({visible:true})).first()
}

export async function setReviewTheme(page, theme, {keyboard = false} = {}) {
  const control = await themeControl(page)
  await control.waitFor()
  const appearance = page.getByRole('button', {name:'Appearance and layout',exact:true}).filter({visible:true})
  if (await appearance.count()) {
    if (keyboard) { await appearance.focus(); await page.keyboard.press('Enter') } else await appearance.click()
    const dialog = page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Workspace preferences',exact:true})})
    const label = theme === 'dark' ? 'Dark' : 'Light'
    const option = dialog.getByRole('button',{name:label,exact:true})
    if (keyboard) {
      await page.waitForFunction(label => [...document.querySelectorAll('[role="dialog"] button')].some(button => button.textContent.trim() === label && !button.disabled), label)
      await option.focus(); await page.keyboard.press('Enter')
    } else await option.click()
    await page.waitForFunction(dark => document.documentElement.classList.contains('dark') === dark, theme === 'dark')
    await page.waitForFunction(() => ![...document.querySelectorAll('[role="dialog"] [aria-busy]')].some(element => element.getAttribute('aria-busy') === 'true'))
    await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'})
  } else {
    const dark = await page.locator('html').evaluate(el => el.classList.contains('dark'))
    if (dark !== (theme === 'dark')) {
      if (keyboard) { await control.focus(); await page.keyboard.press('Enter') } else await control.click()
    }
    await page.waitForFunction(dark => document.documentElement.classList.contains('dark') === dark, theme === 'dark')
  }
}

// In-page provider workspaces deliberately reset on document reload. Inspect their
// responsive states without discarding the selected screen or its unsaved form.
export async function reviewPanel(page, name) {
  const directory = 'scratch/theme-review'
  await mkdir(directory, { recursive: true })
  const original = page.viewportSize()
  const originalDark = await page.locator('html').evaluate(el => el.classList.contains('dark'))
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const dark of [false, true]) {
      if (await page.locator('html').evaluate(el => el.classList.contains('dark')) !== dark) {
        await setReviewTheme(page, dark ? 'dark' : 'light')
      }
      await page.waitForFunction(value => document.documentElement.classList.contains('dark') === value, dark)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: overflow at ${width}`)
      await page.screenshot({ path: `${directory}/${name}-${width}-${dark ? 'dark' : 'light'}.png`, fullPage: true, animations: 'disabled' })
    }
  }
  await page.setViewportSize(original)
  if (await page.locator('html').evaluate(el => el.classList.contains('dark')) !== originalDark) {
    await setReviewTheme(page, originalDark ? 'dark' : 'light')
  }
}

export async function reviewThemes(page, name) {
  await (await themeControl(page)).waitFor()
  // Hide Next's development status badge only; it is absent from production.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  const directory = process.env.COZY_INTEGRATION_FIXTURE ? 'scratch/theme-review' : 'docs/validation/theme-review'
  await mkdir(directory, { recursive: true })
  const original = page.viewportSize()
  const results = []
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['light', 'dark']) {
      const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
      if (dark !== (theme === 'dark')) await setReviewTheme(page, theme)
      await page.waitForFunction(value => document.documentElement.classList.contains('dark') === (value === 'dark'), theme)
      const button = await themeControl(page)
      await button.waitFor()
      assert.equal(await button.count(), 1)
      const bounds = await button.boundingBox()
      assert.ok(bounds.width >= 44 && bounds.height >= 44)
      await page.screenshot({ path: `${directory}/${name}-${width}-${theme}.png`, fullPage: true, animations: "disabled" })
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, undefined, { timeout: 5000 }).catch(async error => {
        console.error('OVERFLOW', name, width, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 15).map(el => ({ tag: el.tagName, classes: el.className, text: el.textContent?.slice(0, 80), right: el.getBoundingClientRect().right })))))
        throw error
      })
      const overflowing = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed').slice(0, 12).map(el => ({ tag: el.tagName, classes: el.className, text: el.textContent?.slice(0, 80), right: el.getBoundingClientRect().right })))
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) console.log('OVERFLOW', name, JSON.stringify(overflowing))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} overflow at ${width} in ${theme}`)
      const background = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)
      const accountPalette = await page.locator('html').evaluate(el => Boolean(el.dataset.cozyAccent))
      assert.equal(background, accountPalette ? (theme === 'dark' ? 'rgb(18, 20, 22)' : 'rgb(245, 246, 248)') : (theme === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(248, 250, 252)'))

      results.push({ width, theme, background, overflow: false, touchTarget: bounds.width })
    }
    const trigger = page.getByRole('button', { name: 'Open navigation', exact: true })
    if (width < 1024 && await trigger.isVisible()) {
      await trigger.click()
      const drawer = page.getByRole('dialog')
      await drawer.waitFor()
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).overflow), 'hidden')
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab')
        assert.equal(await drawer.evaluate(el => el.contains(document.activeElement)), true)
      }
      await page.screenshot({ path: `${directory}/${name}-${width}-drawer.png`, animations: 'disabled' })
      await page.keyboard.press('Escape')
      await drawer.waitFor({ state: 'hidden' })
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true)
      await trigger.click()
      await drawer.waitFor()
      // Use the backdrop's actionability checks after reopening, rather than
      // injecting a raw pointer event before the portal has settled.
      await page.locator('[data-slot="sheet-overlay"]').click({ position: { x: width - 4, y: 450 } })
      await drawer.waitFor({ state: 'hidden' })
      await trigger.click()
      await drawer.waitFor()
      await page.setViewportSize({ width: 1024, height: 900 })
      await drawer.waitFor({ state: 'hidden' })
      assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).overflow), 'hidden')
      await page.setViewportSize({ width, height: 900 })
    }
  }
  await page.reload()
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
  await setReviewTheme(page, 'light', {keyboard:true})
  assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'light')
  await page.evaluate(() => localStorage.removeItem('theme'))
  await page.reload()
  await page.setViewportSize(original)
  await writeFile(`${directory}/${name}.json`, JSON.stringify({ results, persistence: true, keyboard: true }, null, 2))
}
