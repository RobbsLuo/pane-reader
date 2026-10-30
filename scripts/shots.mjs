// 视觉快照：把构建产物装进 Chrome，按多种宽度/主题截图阅读页，外加 popup
// 用法：node scripts/shots.mjs <输出目录>
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const EXT = resolve('dist')
const OUT = resolve(process.argv[2] ?? 'test-artifacts/shots')
const EXE =
  process.env.CHROME_PATH ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

mkdirSync(OUT, { recursive: true })

const ctx = await chromium.launchPersistentContext('', {
  viewport: { width: 1440, height: 900 },
  executablePath: EXE,
  headless: true,
  deviceScaleFactor: 2,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--disable-extensions-file-access-check',
  ],
})

const doc = pathToFileURL(resolve('test-artifacts/docs/showcase.md')).href

async function shoot(page, name) {
  await page.waitForTimeout(900)
  await page.screenshot({ path: resolve(OUT, `${name}.png`) })
}

async function setTheme(page, theme) {
  const current = await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host')?.shadowRoot
    return sr?.querySelector('.mr-root')?.dataset.theme
  })
  if (current !== theme) {
    await page.evaluate(() => {
      const sr = document.getElementById('markdown-reader-host').shadowRoot
      sr.querySelector('[data-act="theme"]').click()
    })
    await page.waitForTimeout(250)
  }
}

const page = await ctx.newPage()
await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(doc)
await setTheme(page, 'light')
await shoot(page, 'read-1440-light')

const top = await page.evaluate(() => {
  const host = document.getElementById('markdown-reader-host')
  return host.scrollTop
})
await page.waitForTimeout(100)

// 滚到正文中段，看代码块/表格/引用
await page.evaluate(() => {
  const host = document.getElementById('markdown-reader-host')
  const sr = host.shadowRoot
  const target = sr.querySelector('.mr-article h2:nth-of-type(2)')
  host.scrollTop = (target?.offsetTop ?? 600) - 40
})
await shoot(page, 'read-1440-mid-light')

await setTheme(page, 'dark')
await shoot(page, 'read-1440-mid-dark')
await page.evaluate(() => {
  document.getElementById('markdown-reader-host').scrollTop = 0
})
await shoot(page, 'read-1440-dark')

await page.setViewportSize({ width: 1100, height: 900 })
await setTheme(page, 'light')
await shoot(page, 'read-1100-light')

await page.setViewportSize({ width: 390, height: 844 })
await shoot(page, 'read-390-light')
await setTheme(page, 'dark')
await shoot(page, 'read-390-dark')

// 工具栏/文件树：打开目录索引页
await page.setViewportSize({ width: 1440, height: 900 })
await setTheme(page, 'light')
await page.goto(pathToFileURL(resolve('test-artifacts/docs/index.md')).href)
await page.waitForTimeout(1200)
await shoot(page, 'tree-1440-light')
await setTheme(page, 'dark')
await shoot(page, 'tree-1440-dark')

// 字体放大后的层级
await page.setViewportSize({ width: 1440, height: 900 })
await setTheme(page, 'light')
await page.goto(doc)
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('[data-act="font-plus"]').click()
  })
}
await shoot(page, 'read-1440-bigfont')

// popup
const popupUrl = `chrome-extension://${await (async () => {
  let id = ''
  const bg = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
  id = new URL(bg.url()).host
  return id
})()}/popup.html`
const popupPage = await ctx.newPage()
await popupPage.setViewportSize({ width: 340, height: 560 })
await popupPage.goto(popupUrl)
await popupPage.waitForTimeout(400)
await popupPage.screenshot({ path: resolve(OUT, 'popup.png') })
await popupPage.emulateMedia({ colorScheme: 'dark' })
await popupPage.waitForTimeout(300)
await popupPage.screenshot({ path: resolve(OUT, 'popup-dark.png') })

await ctx.close()
console.log(`shots → ${OUT}`)
