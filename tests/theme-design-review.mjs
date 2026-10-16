import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

export async function reviewThemes(page, name) {
  await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).filter({ visible: true }).waitFor()
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
      if (dark !== (theme === 'dark')) await page.getByRole('button', { name: dark ? 'Switch to light mode' : 'Switch to dark mode', exact: true }).filter({ visible: true }).click()
      await page.waitForFunction(value => document.documentElement.classList.contains('dark') === (value === 'dark'), theme)
      const button = page.getByRole('button', { name: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', exact: true }).filter({ visible: true })
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
      assert.equal(background, theme === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(248, 250, 252)')

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
      await page.mouse.click(width - 4, 450)
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
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).filter({ visible: true }).waitFor()
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).filter({ visible: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).filter({ visible: true }).waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'light')
  await page.evaluate(() => localStorage.removeItem('theme'))
  await page.reload()
  await page.setViewportSize(original)
  await writeFile(`${directory}/${name}.json`, JSON.stringify({ results, persistence: true, keyboard: true }, null, 2))
}
