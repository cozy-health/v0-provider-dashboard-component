import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

export async function reviewThemes(page, name) {
  await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).waitFor()
  // Hide Next's development status badge only; it is absent from production.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  const directory = 'docs/validation/theme-review'
  await mkdir(directory, { recursive: true })
  const original = page.viewportSize()
  const results = []
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['light', 'dark']) {
      const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
      if (dark !== (theme === 'dark')) await page.getByRole('button', { name: dark ? 'Switch to light mode' : 'Switch to dark mode', exact: true }).click()
      await page.waitForFunction(value => document.documentElement.classList.contains('dark') === (value === 'dark'), theme)
      const button = page.getByRole('button', { name: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', exact: true })
      await button.waitFor()
      assert.equal(await button.count(), 1)
      const bounds = await button.boundingBox()
      assert.ok(bounds.width >= 44 && bounds.height >= 44)
      await page.screenshot({ path: `${directory}/${name}-${width}-${theme}.png`, fullPage: true, animations: "disabled" })
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, undefined, { timeout: 5000 })
      const overflowing = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed').slice(0, 12).map(el => ({ tag: el.tagName, classes: el.className, text: el.textContent?.slice(0, 80), right: el.getBoundingClientRect().right })))
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) console.log('OVERFLOW', name, JSON.stringify(overflowing))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} overflow at ${width} in ${theme}`)
      const background = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)
      assert.equal(background, theme === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)')

      results.push({ width, theme, background, overflow: false, touchTarget: bounds.width })
    }
  }
  await page.reload()
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'light')
  await page.evaluate(() => localStorage.removeItem('theme'))
  await page.reload()
  await page.setViewportSize(original)
  await writeFile(`${directory}/${name}.json`, JSON.stringify({ results, persistence: true, keyboard: true }, null, 2))
}
