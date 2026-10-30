// 临时校验：目录收起 + 中等宽度下纸面是否仍然对称
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
  viewport: { width: 1280, height: 900 },
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
const page = await ctx.newPage()

async function shoot(name) {
  await page.waitForTimeout(700)
  await page.screenshot({ path: resolve(OUT, `${name}.png`) })
  const box = await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const a = sr.querySelector('.mr-article').getBoundingClientRect()
    const p = sr.querySelector('.mr-article p').getBoundingClientRect()
    return { article: [Math.round(a.left), Math.round(a.right)], p: [Math.round(p.left), Math.round(p.right)] }
  })
  console.log(name, JSON.stringify(box))
}

// 1180 以下目录本来就隐藏；这里再手动收起文件树，复现用户截图的最宽情形
for (const width of [1536, 1180, 1100]) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(doc)
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const btn = sr.querySelector('[data-act="files"]')
    if (btn) btn.click()
  })
  await shoot(`sheet-${width}-nosidebar`)
}

await ctx.close()
