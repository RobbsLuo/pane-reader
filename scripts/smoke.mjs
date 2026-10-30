import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const EXT = resolve('dist')
const EXE =
  process.env.CHROME_PATH ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

const SAMPLE = `# Pane Reader 冒烟测试

这是一段**中文正文**，包含行内代码 \`npm run build\` 和[链接](https://example.com)。

## 二级标题

| 功能 | 状态 |
| --- | --- |
| 本地文件 | ✅ |
| 在线 md | ✅ |

- [x] 渲染 GFM
- [ ] 导出 PDF

### 代码块

\`\`\`ts
const answer: number = 42
console.log(answer)
\`\`\`

### 图表

\`\`\`mermaid
graph TD
  A[开始] --> B{判断}
  B -->|是| C[完成]
  B -->|否| D[重试]
\`\`\`

## 数学公式

行内公式 $E = mc^2$，块级公式：

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

> 引用块用于测试样式。

![测试图](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='120'%20height='60'%3E%3Crect%20width='120'%20height='60'%20fill='%230969da'/%3E%3C/svg%3E)
`

const PIC_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAw0lEQVR4nO3QMQ1CURTA0GcCCSjDLk5wwAIO/nZzLqFDxyZNz/t5+1xxf7wu+XX/6ADtN0AHaL8BOkD7DdAB2j/bA6f9BugA7TdAB2i/ATpA+w3YHjjtN0AHaL8BOkD7DdAB2m/A9sBpvwE6QPsN0AHab4AO0H4DtgdO+w3QAdpvgA7QfgN0gPYbsD1w2m+ADtB+A3SA9hugA7TfgO2B034DdID2G6ADtN8AHaD9BmwPnPYboAO03wAdoP0G6ADt//2AL0/OYndu0aiBAAAAAElFTkSuQmCC',
  'base64',
)

const server = createServer((req, res) => {
  if (req.url?.startsWith('/test.md')) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(SAMPLE)
    return
  }
  // 模拟 autoindex 目录，验证在线文件树
  if (req.url === '/docs/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      '<html><body><a href="../">../</a><a href="a.md">a.md</a><a href="b.md">b.md</a><a href="sub/">sub/</a><a href="x.txt">x.txt</a></body></html>',
    )
    return
  }
  if (req.url === '/docs/a.md') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(SAMPLE)
    return
  }
  // 在线 HTML 预览：独立的目录，避免影响别的目录树断言
  if (req.url === '/htmlpreview/a.md') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(SAMPLE)
    return
  }
  if (req.url === '/htmlpreview/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      '<html><body><a href="../">../</a><a href="a.md">a.md</a><a href="r.html">r.html</a></body></html>',
    )
    return
  }
  if (req.url === '/htmlpreview/r.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      '<!doctype html><html lang="zh"><head><meta charset="utf-8"><link rel="stylesheet" href="r.css"></head><body><div id="probe">脚本未执行</div><button id="btn" onclick="document.getElementById(\'count\').textContent=String(Number(document.getElementById(\'count\').textContent)+1)">点我</button><span id="count">0</span><img id="shot" src="r.png" width="24" height="24"><script>document.getElementById("probe").textContent="脚本已执行"</script></body></html>',
    )
    return
  }
  if (req.url === '/htmlpreview/r.css') {
    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' })
    res.end('#probe{background:#0a0;color:#fff;padding:8px}')
    return
  }
  if (req.url === '/htmlpreview/r.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(PIC_PNG)
    return
  }
  res.writeHead(404).end()
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
mkdirSync('test-artifacts', { recursive: true })
mkdirSync('test-artifacts/docs/sub', { recursive: true })
writeFileSync('test-artifacts/docs/index.md', SAMPLE)
writeFileSync('test-artifacts/docs/guide.md', '# Guide\n\n第一篇。\n')
writeFileSync('test-artifacts/docs/images.md', '# 本地图片\n\n![本地图](pic.png)\n')
writeFileSync(
  'test-artifacts/docs/alerts.md',
  [
    '# 提示块',
    '',
    '> [!NOTE]',
    '> 普通提示。',
    '',
    '> [!TIP]',
    '> 小技巧。',
    '',
    '> [!IMPORTANT]',
    '> 重要说明。',
    '',
    '> [!WARNING]',
    '> 警告内容。',
    '',
    '> [!CAUTION]',
    '> 危险操作。',
    '',
    '> 普通引用不受影响。',
  ].join('\n'),
)
writeFileSync(
  'test-artifacts/docs/frontmatter.md',
  '---\ntitle: 冒烟标题\nauthor: 测试\n---\n\n# 正文标题\n\n正文段落。\n',
)
writeFileSync(
  'test-artifacts/docs/long.md',
  `# 长文档\n\n${Array.from({ length: 120 }, (_, i) => `## 小节 ${i + 1}\n\n第 ${i + 1} 段正文，用于验证滚动位置记忆。\n`).join('\n')}`,
)
writeFileSync('test-artifacts/docs/a-very-long-file-name-for-hover-tooltip-check.md', '# 长文件名\n\n正文。\n')
writeFileSync('test-artifacts/docs/sub/deep.md', '# Deep\n\n子目录文件。\n')
writeFileSync('test-artifacts/docs/x.txt', 'not markdown')
writeFileSync(
  'test-artifacts/docs/sample.html',
  '<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>HTML 预览</title></head><body><h1>HTML 预览检查</h1><p>本地静态页面</p></body></html>',
)
// 沙箱检查用：外链 CSS + 相对图片 + 内联脚本；脚本必须能跑（按钮可点），
// 同时拿不到父页面 DOM，相对资源也要照常加载
writeFileSync('test-artifacts/docs/sandbox.css', '#probe{background:#0a0;color:#fff;padding:8px}')
writeFileSync(
  'test-artifacts/docs/sandbox.html',
  '<!doctype html><html lang="zh"><head><meta charset="utf-8"><link rel="stylesheet" href="sandbox.css"></head><body><div id="probe">脚本未执行</div><button id="btn" onclick="document.getElementById(\'count\').textContent=String(Number(document.getElementById(\'count\').textContent)+1)">点我</button><span id="count">0</span><img id="shot" src="pic.png" width="24" height="24"><script>document.getElementById("probe").textContent="脚本已执行"</script></body></html>',
)

// 其他文件类型：图片 / 文本 / JSON / PDF / 音频
writeFileSync(
  'test-artifacts/docs/pic.png',
  PIC_PNG,
)
writeFileSync('test-artifacts/docs/note.txt', '第一行\n第二行\n')
writeFileSync('test-artifacts/docs/data.json', '{"a":1,"list":[1,2,3]}')
writeFileSync(
  'test-artifacts/docs/doc.pdf',
  Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
    'latin1',
  ),
)
{
  const rate = 8000
  const samples = Math.round(rate * 0.2)
  const data = Buffer.alloc(samples * 2)
  const wav = Buffer.alloc(44 + data.length)
  wav.write('RIFF', 0, 'latin1')
  wav.writeUInt32LE(36 + data.length, 4)
  wav.write('WAVEfmt ', 8, 'latin1')
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36, 'latin1')
  wav.writeUInt32LE(data.length, 40)
  data.copy(wav, 44)
  writeFileSync('test-artifacts/docs/tone.wav', wav)
}

const ctx = await chromium.launchPersistentContext('', {
  viewport: { width: 1440, height: 900 },
  executablePath: EXE,
  headless: true,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--disable-extensions-file-access-check',
  ],
})

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failed++
}

async function inspect(page) {
  await page.waitForFunction(
    () => !!document.getElementById('markdown-reader-host')?.shadowRoot,
    { timeout: 15_000 },
  )
  return page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const article = sr.querySelector('.mr-article')
    return {
      h1: article?.querySelector('h1')?.textContent?.trim() ?? '',
      h2Count: article?.querySelectorAll('h2').length ?? 0,
      codeBlocks: article?.querySelectorAll('pre code').length ?? 0,
      highlighted: article?.querySelectorAll('pre code .hljs-keyword, pre code .hljs-string').length ?? 0,
      tableRows: article?.querySelectorAll('table tr').length ?? 0,
      katex: article?.querySelectorAll('.katex').length ?? 0,
      taskItems: article?.querySelectorAll('.task-list-item').length ?? 0,
      tocLinks: sr.querySelectorAll('.mr-toc a').length ?? 0,
      copyButtons: sr.querySelectorAll('.mr-copy').length ?? 0,
      theme: sr.querySelector('.mr-root')?.dataset.theme ?? '',
      fontSize: sr.querySelector('.mr-root')?.style.getPropertyValue('--mr-font-size') ?? '',
    }
  })
}

try {
  // 1. http 上的 .md
  const page = await ctx.newPage()
  await page.goto(`http://127.0.0.1:${port}/test.md`)
  const r = await inspect(page)
  check('在线 .md 被接管', r.h1.includes('冒烟测试'), r.h1)
  check('标题分级', r.h2Count >= 1, `h2=${r.h2Count}`)
  check('代码高亮', r.codeBlocks >= 1 && r.highlighted >= 1, `blocks=${r.codeBlocks}, hl=${r.highlighted}`)
  check('表格', r.tableRows >= 2, `rows=${r.tableRows}`)
  check('KaTeX', r.katex >= 2, `nodes=${r.katex}`)
  check('任务列表', r.taskItems >= 2, `items=${r.taskItems}`)
  check('目录生成', r.tocLinks >= 3, `links=${r.tocLinks}`)
  check('复制按钮', r.copyButtons >= 1, `buttons=${r.copyButtons}`)
  check('主题生效', !!r.theme, r.theme)
  check('字号变量', r.fontSize.includes('px'), r.fontSize)

  // 1.1 版式：正文、代码块、表格共用同一列宽，全部吃满内容列
  const measure = await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const w = (s) => Math.round(sr.querySelector(s)?.getBoundingClientRect().width ?? 0)
    const article = w('.mr-article')
    return { article, p: w('.mr-article > p'), pre: w('.mr-article pre'), table: w('.mr-article table') }
  })
  // 纸面带左右内边距，正文/代码/表格统一吃满内容列，纸面本身比它们更宽
  check(
    '正文/代码块/表格同宽，纸面留内边距',
    measure.p === measure.pre &&
      measure.p === measure.table &&
      measure.article - measure.p >= 40,
    JSON.stringify(measure),
  )
  await page.screenshot({ path: 'test-artifacts/http.png' })

  const noTree = await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return {
      sidebarHidden: sr.querySelector('.mr-sidebar').hidden,
      filesButtonHidden: sr.querySelector('[data-act="files"]').hidden,
    }
  })
  check('无目录索引时隐藏文件树', noTree.sidebarHidden && noTree.filesButtonHidden, JSON.stringify(noTree))

  // 1.5 大纲点击跳转（文章在 shadow DOM 内，不能靠 document.getElementById）
  await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const article = sr.querySelector('.mr-article')
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('p')
      p.textContent = `占位段落 ${i}，用于撑长页面验证目录跳转。`
      article.append(p)
    }
  })
  const scrollBefore = await page.evaluate(
    () => document.getElementById('markdown-reader-host').scrollTop,
  )
  await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const links = sr.querySelectorAll('.mr-toc a')
    links[links.length - 1].click()
  })
  await page.waitForTimeout(1200)
  const scrollAfter = await page.evaluate(
    () => document.getElementById('markdown-reader-host').scrollTop,
  )
  check(
    '大纲点击跳转',
    scrollAfter > 100 && scrollAfter !== scrollBefore,
    `scrollTop ${scrollBefore} → ${scrollAfter}`,
  )

  // 2. 工具栏交互：切换主题
  await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('[data-act="theme"]').click()
  })
  const themed = await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return sr.querySelector('.mr-root').dataset.theme
  })
  check('主题切换按钮', themed === 'dark' || themed === 'light', themed)
  await page.screenshot({ path: 'test-artifacts/dark.png' })

  // 3. 原始源码切换
  await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('[data-act="raw"]').click()
  })
  const rawVisible = await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const source = sr.querySelector('.mr-source')
    return {
      sourceShown: !source.hidden,
      articleHidden: sr.querySelector('.mr-article').hidden,
      startsWithHash: source.textContent.trimStart().startsWith('#'),
      toolbarAlive: !!sr.querySelector('.mr-toolbar'),
    }
  })
  check(
    'Raw 视图',
    rawVisible.sourceShown && rawVisible.articleHidden && rawVisible.startsWithHash && rawVisible.toolbarAlive,
    JSON.stringify(rawVisible),
  )

  // 切回预览
  await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('[data-act="raw"]').click()
  })
  const backToPreview = await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return !sr.querySelector('.mr-article').hidden
  })
  check('Raw → 预览返回', backToPreview)

  // 3.5 在线 autoindex 目录树
  const dirPage = await ctx.newPage()
  await dirPage.goto(`http://127.0.0.1:${port}/docs/a.md`)
  await inspect(dirPage)
  const onlineTree = await dirPage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const nodes = Array.from(sr.querySelectorAll('.mr-tree > .mr-node'))
    return {
      sidebarHidden: sr.querySelector('.mr-sidebar').hidden,
      names: nodes.map((n) => n.querySelector('.mr-node-name')?.textContent),
      dirFirst: nodes[0]?.dataset.type === 'dir',
      current: nodes.filter((n) => n.classList.contains('is-current')).length,
    }
  })
  check(
    '在线目录树',
    !onlineTree.sidebarHidden &&
      onlineTree.names.length === 4 &&
      onlineTree.names.includes('x.txt') &&
      onlineTree.dirFirst &&
      onlineTree.current === 1,
    JSON.stringify(onlineTree),
  )
  await dirPage.screenshot({ path: 'test-artifacts/http-tree.png' })

  // 3.6 在线 HTML 预览：按钮能点，但不给 same-origin（拿不到站点 cookie / 父页面 DOM）
  const remoteHtml = await ctx.newPage()
  await remoteHtml.goto(`http://127.0.0.1:${port}/htmlpreview/a.md`)
  await inspect(remoteHtml)
  await remoteHtml.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    Array.from(sr.querySelectorAll('.mr-tree .mr-node-name'))
      .find((n) => n.textContent === 'r.html')
      ?.click()
  })
  await remoteHtml.waitForTimeout(700)
  const remoteFrame = remoteHtml.frames().find((f) => f.url().includes('/htmlpreview/r.html'))
  const remoteState = remoteFrame
    ? await remoteFrame.evaluate(() => {
        document.getElementById('btn')?.click()
        return {
          text: document.getElementById('probe')?.textContent ?? '',
          clicked: document.getElementById('count')?.textContent ?? '',
          bg: getComputedStyle(document.getElementById('probe')).backgroundColor,
          imgWidth: document.querySelector('#shot')?.naturalWidth ?? 0,
          canSeeParent: (() => {
            try {
              return Boolean(window.parent.document)
            } catch {
              return false
            }
          })(),
        }
      })
    : { text: '', clicked: '', bg: '', imgWidth: 0, canSeeParent: true }
  const remoteSandbox = await remoteHtml.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return sr.querySelector('.mr-preview-frame').getAttribute('sandbox') ?? ''
  })
  check(
    '在线 HTML 预览沙箱（可交互、不同源）',
    remoteSandbox.includes('allow-scripts') &&
      !remoteSandbox.includes('allow-same-origin') &&
      remoteState.text === '脚本已执行' &&
      remoteState.clicked === '1' &&
      remoteState.bg === 'rgb(0, 170, 0)' &&
      remoteState.imgWidth > 0 &&
      !remoteState.canSeeParent,
    JSON.stringify({ remoteSandbox, ...remoteState }),
  )
  await remoteHtml.close()

  // 4. file:// 本地 md
  const fileUrl = pathToFileURL(resolve('test-artifacts/docs/index.md')).href
  const filePage = await ctx.newPage()
  await filePage.goto(fileUrl)
  const fr = await inspect(filePage)
  check('本地 file:// .md', fr.h1.includes('冒烟测试'), fr.h1)

  // 本地相对图片：DOMPurify 不能把 file: 的 src 清掉
  const imgPage = await ctx.newPage()
  await imgPage.goto(pathToFileURL(resolve('test-artifacts/docs/images.md')).href)
  await imgPage.waitForTimeout(1500)
  const localImg = await imgPage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host')?.shadowRoot
    const img = sr?.querySelector('.mr-article img')
    return {
      src: img?.getAttribute('src') ?? '',
      naturalWidth: img?.naturalWidth ?? 0,
    }
  })
  check(
    '本地相对图片可加载',
    localImg.src.endsWith('/test-artifacts/docs/pic.png') && localImg.naturalWidth > 0,
    JSON.stringify(localImg),
  )
  await imgPage.close()

  // GitHub 提示块：5 种类型都渲染成带类型的 blockquote，标记文本被摘掉
  const alertPage = await ctx.newPage()
  await alertPage.goto(pathToFileURL(resolve('test-artifacts/docs/alerts.md')).href)
  await alertPage.waitForTimeout(1200)
  const alerts = await alertPage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host')?.shadowRoot
    const quotes = Array.from(sr?.querySelectorAll('.mr-article blockquote') ?? [])
    return {
      kinds: quotes
        .map((q) => q.getAttribute('data-alert'))
        .filter((k) => Boolean(k)),
      plain: quotes.filter((q) => !q.hasAttribute('data-alert')).length,
      leftover: quotes.some((q) => q.textContent?.includes('[!')),
      firstColor: quotes[0]
        ? getComputedStyle(quotes[0], '::before').content
        : '',
    }
  })
  check(
    'GitHub 提示块',
    alerts.kinds.join(',') === 'note,tip,important,warning,caution' &&
      alerts.plain === 1 &&
      !alerts.leftover &&
      alerts.firstColor.includes('NOTE'),
    JSON.stringify(alerts),
  )
  await alertPage.close()

  // front matter：正文不出现 YAML / ---，属性进折叠面板
  const fmPage = await ctx.newPage()
  await fmPage.goto(pathToFileURL(resolve('test-artifacts/docs/frontmatter.md')).href)
  await fmPage.waitForTimeout(1200)
  const fm = await fmPage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host')?.shadowRoot
    const article = sr?.querySelector('.mr-article')
    const meta = article?.querySelector('.mr-meta')
    return {
      meta: Boolean(meta),
      summary: meta?.querySelector('summary')?.textContent ?? '',
      keys: Array.from(meta?.querySelectorAll('dt') ?? []).map((n) => n.textContent),
      values: Array.from(meta?.querySelectorAll('dd') ?? []).map((n) => n.textContent),
      bodyText: Array.from(article?.querySelectorAll('h1, p') ?? [])
        .map((n) => n.textContent ?? '')
        .join('|'),
      open: meta?.hasAttribute('open') ?? false,
    }
  })
  check(
    'front matter 折叠',
    fm.meta &&
      !fm.open &&
      fm.keys.join(',') === 'title,author' &&
      fm.values.join(',') === '冒烟标题,测试' &&
      fm.bodyText.includes('正文标题') &&
      !fm.bodyText.includes('title:'),
    JSON.stringify(fm),
  )
  await fmPage.close()

  // 阅读位置记忆：滚动 → 刷新 → 位置恢复
  const longPage = await ctx.newPage()
  await longPage.goto(pathToFileURL(resolve('test-artifacts/docs/long.md')).href)
  await longPage.waitForTimeout(1500)
  const scrolled = await longPage.evaluate(async () => {
    const host = document.getElementById('markdown-reader-host')
    if (!host) return { ok: false }
    host.scrollTop = 900
    await new Promise((r) => setTimeout(r, 900))
    return { ok: true, top: host.scrollTop, height: host.scrollHeight }
  })
  await longPage.reload()
  await longPage.waitForTimeout(1800)
  const restoredScroll = await longPage.evaluate(() => {
    const host = document.getElementById('markdown-reader-host')
    return { top: host?.scrollTop ?? 0, height: host?.scrollHeight ?? 0 }
  })
  check(
    '阅读位置记忆',
    scrolled.ok &&
      scrolled.height > 2000 &&
      Math.abs(restoredScroll.top - 900) < 60,
    JSON.stringify({ ...scrolled, restoredScroll }),
  )
  await longPage.close()

  await filePage.waitForFunction(() => {
    const sr = document.getElementById('markdown-reader-host')?.shadowRoot
    return sr && !sr.querySelector('.mr-sidebar').hidden
  }, { timeout: 15_000 })

  const localTree = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const nodes = Array.from(sr.querySelectorAll('.mr-tree > .mr-node'))
    return {
      sidebarHidden: sr.querySelector('.mr-sidebar').hidden,
      title: sr.querySelector('.mr-sidebar-title').textContent,
      names: nodes.map((n) => n.querySelector('.mr-node-name')?.textContent),
      dirFirst: nodes[0]?.dataset.type === 'dir',
      current: nodes.filter((n) => n.classList.contains('is-current')).length,
    }
  })
  check(
    '本地目录树',
    !localTree.sidebarHidden &&
      localTree.title === 'docs' &&
      localTree.names.includes('index.md') &&
      localTree.names.includes('guide.md') &&
      localTree.names.includes('sample.html') &&
      localTree.names.includes('x.txt') &&
      localTree.names.includes('pic.png') &&
      localTree.names.includes('doc.pdf') &&
      localTree.dirFirst &&
      localTree.current === 1,
    JSON.stringify(localTree),
  )

  // 3.8 切换文件：不残留 booting 遮罩，主题 hash 被清掉
  const guideUrl = pathToFileURL(resolve('test-artifacts/docs/guide.md')).href
  await filePage.evaluate((url) => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const link = Array.from(sr.querySelectorAll('.mr-tree .mr-node-name')).find(
      (n) => n.textContent === 'guide.md',
    )
    link.click()
  }, guideUrl)
  await filePage.waitForURL(/guide\.md/, { timeout: 10_000 })
  await inspect(filePage)
  const switched = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return {
      h1: sr.querySelector('.mr-article h1')?.textContent?.trim() ?? '',
      booting: document.documentElement.classList.contains('mr-booting'),
      preflight: !!document.getElementById('markdown-reader-preflight'),
      hash: location.hash,
      leaving: sr.querySelector('.mr-root').classList.contains('is-leaving'),
    }
  })
  check(
    '文件切换无残留遮罩',
    switched.h1 === 'Guide' && !switched.booting && !switched.preflight && !switched.leaving && switched.hash === '',
    JSON.stringify(switched),
  )

  // 回到 index.md，后续断言依赖它的内容
  await filePage.goto(fileUrl)
  await inspect(filePage)
  await filePage.waitForFunction(() => {
    const sr = document.getElementById('markdown-reader-host')?.shadowRoot
    return sr && !sr.querySelector('.mr-sidebar').hidden
  }, { timeout: 15_000 })

  // 展开子目录
  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('.mr-tree > .mr-node[data-type="dir"] .mr-node-row').click()
  })
  await filePage.waitForTimeout(600)
  const expanded = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return Array.from(sr.querySelectorAll('.mr-children .mr-node-name')).map(
      (n) => n.textContent,
    )
  })
  check('子目录懒加载', expanded.includes('deep.md'), expanded.join(','))

  // HTML 预览：点树里的 .html 不跳页，正文区换成 iframe
  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const link = Array.from(sr.querySelectorAll('.mr-tree .mr-node-name')).find(
      (n) => n.textContent === 'sample.html',
    )
    link.click()
  })
  await filePage.waitForTimeout(700)
  const previewState = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return {
      previewHidden: sr.querySelector('.mr-preview').hidden,
      articleHidden: sr.querySelector('.mr-article').hidden,
      src: sr.querySelector('.mr-preview-frame').getAttribute('src') ?? '',
      name: sr.querySelector('.mr-preview-name').textContent,
      current: Array.from(sr.querySelectorAll('.mr-tree .mr-node')).filter((n) =>
        n.classList.contains('is-current'),
      ).map((n) => n.querySelector('.mr-node-name')?.textContent),
      url: location.href,
    }
  })
  const htmlFrame = filePage.frames().find((f) => f.url().includes('sample.html'))
  const frameH1 = htmlFrame
    ? await htmlFrame.evaluate(() => document.querySelector('h1')?.textContent ?? '')
    : ''
  check(
    'HTML 预览',
    !previewState.previewHidden &&
      previewState.articleHidden &&
      previewState.src.includes('sample.html') &&
      previewState.name === 'sample.html' &&
      previewState.current.length === 1 &&
      previewState.current[0] === 'sample.html' &&
      previewState.url.endsWith('index.md') &&
      frameH1 === 'HTML 预览检查',
    JSON.stringify({ ...previewState, frameH1 }),
  )

  // 预览态的源码视图读到的是 HTML 原文
  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('[data-act="raw"]').click()
  })
  await filePage.waitForTimeout(400)
  const rawHtml = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return {
      visible: !sr.querySelector('.mr-source').hidden,
      text: sr.querySelector('.mr-source').textContent ?? '',
    }
  })
  check(
    'HTML 源码视图',
    rawHtml.visible && rawHtml.text.includes('<h1>HTML 预览检查</h1>'),
    rawHtml.text.slice(0, 80),
  )

  // 关闭预览回到原 Markdown
  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('[data-act="raw"]').click()
  })
  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('.mr-preview-close').click()
  })
  await filePage.waitForTimeout(200)
  const afterClose = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return {
      previewHidden: sr.querySelector('.mr-preview').hidden,
      articleHidden: sr.querySelector('.mr-article').hidden,
      h1: sr.querySelector('.mr-article h1')?.textContent?.trim() ?? '',
      current: Array.from(sr.querySelectorAll('.mr-tree .mr-node.is-current')).map(
        (n) => n.querySelector('.mr-node-name')?.textContent,
      ),
    }
  })
  check(
    '关闭预览恢复正文',
    afterClose.previewHidden &&
      !afterClose.articleHidden &&
      afterClose.h1.includes('冒烟测试') &&
      afterClose.current[0] === 'index.md',
    JSON.stringify(afterClose),
  )

  // ---- 沙箱：脚本可执行（按钮能点），但仍然拿不到父页面 ----
  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    Array.from(sr.querySelectorAll('.mr-tree .mr-node-name'))
      .find((n) => n.textContent === 'sandbox.html')
      ?.click()
  })
  await filePage.waitForTimeout(700)
  const sandboxFrame = filePage.frames().find((f) => f.url().includes('sandbox.html'))
  const sandboxState = sandboxFrame
    ? await sandboxFrame.evaluate(() => {
        const btn = document.getElementById('btn')
        btn?.click()
        return {
          text: document.getElementById('probe')?.textContent ?? '',
          clicked: document.getElementById('count')?.textContent ?? '',
          bg: getComputedStyle(document.getElementById('probe')).backgroundColor,
          imgWidth: document.querySelector('#shot')?.naturalWidth ?? 0,
          escaped: (() => {
            try {
              return document.getElementById('markdown-reader-host') !== null
            } catch {
              return true
            }
          })(),
        }
      })
    : { text: '', clicked: '', bg: '', imgWidth: 0, escaped: true }
  const sandboxAttr = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return sr.querySelector('.mr-preview-frame').getAttribute('sandbox') ?? ''
  })
  check(
    'HTML 预览沙箱（本地可交互）',
    sandboxAttr.includes('allow-scripts') &&
      sandboxAttr.includes('allow-same-origin') &&
      sandboxState.text === '脚本已执行' &&
      sandboxState.clicked === '1' &&
      sandboxState.bg === 'rgb(0, 170, 0)' &&
      sandboxState.imgWidth > 0 &&
      !sandboxState.escaped,
    JSON.stringify({ sandboxAttr, ...sandboxState }),
  )
  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('.mr-preview-close').click()
  })

  // ---- 其他文件类型预览 ----
  const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker', { timeout: 5000 }).catch(() => null))
  const extId = worker ? new URL(worker.url()).host : ''
  const popup = extId ? await ctx.newPage() : null
  if (popup) await popup.goto(`chrome-extension://${extId}/popup.html`)
  const otherEnabled = Boolean(popup)
  if (popup) {
    // 默认就应勾选并直接列出图片 / PDF 等文件，无需手动开启
    check('其他文件默认可见', await popup.locator('#showOtherFiles').isChecked(), '')
    await filePage
      .waitForFunction(
        () => {
          const sr = document.getElementById('markdown-reader-host')?.shadowRoot
          return Array.from(sr?.querySelectorAll('.mr-tree .mr-node-name') ?? []).some(
            (n) => n.textContent === 'pic.png',
          )
        },
        { timeout: 10_000 },
      )
      .catch(() => {})
  }

  const clickFile = (name) =>
    filePage.evaluate((name) => {
      const sr = document.getElementById('markdown-reader-host').shadowRoot
      const node = Array.from(sr.querySelectorAll('.mr-tree .mr-node-name')).find(
        (n) => n.textContent === name,
      )
      if (node) node.click()
    }, name)

  const previewInfo = () =>
    filePage.evaluate(() => {
      const sr = document.getElementById('markdown-reader-host').shadowRoot
      const img = sr.querySelector('.mr-preview-image')
      const text = sr.querySelector('.mr-preview-text')
      const frame = sr.querySelector('.mr-preview-frame')
      const audio = sr.querySelector('.mr-media-wrap audio, .mr-media-wrap video')
      return {
        previewHidden: sr.querySelector('.mr-preview').hidden,
        imageVisible: !sr.querySelector('.mr-image-wrap').hidden,
        textVisible: !text.hidden,
        frameVisible: !frame.hidden,
        mediaVisible: !sr.querySelector('.mr-media-wrap').hidden,
        naturalWidth: img?.naturalWidth ?? 0,
        meta: sr.querySelector('.mr-preview-meta').textContent,
        text: text.textContent,
        frameSrc: frame.getAttribute('src') ?? '',
        mediaSrc: audio?.getAttribute('src') ?? '',
        rawDisabled: sr.querySelector('[data-act="raw"]').disabled,
      }
    })

  if (otherEnabled) {
    await clickFile('pic.png')
    await filePage.waitForTimeout(500)
    const imgState = await previewInfo()
    check(
      '图片预览',
      !imgState.previewHidden &&
        imgState.imageVisible &&
        imgState.naturalWidth > 0 &&
        imgState.meta.includes('×') &&
        imgState.rawDisabled,
      JSON.stringify(imgState),
    )

    const imgBox = await filePage.evaluate(() => {
      const sr = document.getElementById('markdown-reader-host').shadowRoot
      const box = sr.querySelector('.mr-image-wrap').getBoundingClientRect()
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    })
    await filePage.mouse.move(imgBox.x, imgBox.y)
    await filePage.mouse.wheel(0, -420)
    await filePage.waitForTimeout(200)
    const zoomed = await filePage.evaluate(() => {
      const sr = document.getElementById('markdown-reader-host').shadowRoot
      const img = sr.querySelector('.mr-preview-image')
      return {
        transform: img.style.transform,
        meta: sr.querySelector('.mr-preview-meta').textContent,
      }
    })
    await filePage.mouse.dblclick(imgBox.x, imgBox.y)
    await filePage.waitForTimeout(200)
    const restored = await filePage.evaluate(() => {
      const sr = document.getElementById('markdown-reader-host').shadowRoot
      return sr.querySelector('.mr-preview-image').style.transform
    })
    check(
      '图片滚轮缩放与双击复位',
      /scale\((?!1\))/.test(zoomed.transform) &&
        /1[0-9]{2}%|2[0-9]{2}%|[4-9][0-9]{2}%/.test(zoomed.meta) &&
        /scale\(1\)/.test(restored),
      JSON.stringify({ zoomed, restored }),
    )

    await clickFile('note.txt')
    await filePage
      .waitForFunction(
        () => {
          const sr = document.getElementById('markdown-reader-host')?.shadowRoot
          const text = sr?.querySelector('.mr-preview-text')?.textContent ?? ''
          return text.includes('第二行')
        },
        { timeout: 5000 },
      )
      .catch(() => {})
    const textState = await previewInfo()
    check(
      '文本预览',
      textState.textVisible && textState.text.includes('第一行') && textState.meta.includes('行'),
      JSON.stringify({ meta: textState.meta, head: textState.text.slice(0, 30) }),
    )

    await clickFile('data.json')
    await filePage.waitForTimeout(500)
    const jsonState = await previewInfo()
    check(
      'JSON 自动美化',
      jsonState.textVisible && jsonState.text.includes('"a": 1') && jsonState.text.includes('\n  "list"'),
      JSON.stringify({ head: jsonState.text.slice(0, 60) }),
    )

    await clickFile('doc.pdf')
    await filePage.waitForTimeout(1200)
    const pdfState = await previewInfo()
    const pdfFrame = filePage.frames().some((f) => f.url().includes('doc.pdf'))
    check(
      'PDF 预览',
      pdfState.frameVisible && pdfState.frameSrc.endsWith('doc.pdf') && pdfState.rawDisabled && pdfFrame,
      JSON.stringify({ ...pdfState, pdfFrame }),
    )

    await clickFile('tone.wav')
    await filePage.waitForTimeout(700)
    const mediaState = await previewInfo()
    check(
      '音视频预览',
      mediaState.mediaVisible && mediaState.mediaSrc.endsWith('tone.wav'),
      JSON.stringify(mediaState),
    )

    await popup.locator('#showOtherFiles').uncheck()
    await filePage.waitForTimeout(700)
    const afterDisable = await filePage.evaluate(() => {
      const sr = document.getElementById('markdown-reader-host').shadowRoot
      return Array.from(sr.querySelectorAll('.mr-tree .mr-node-name')).map((n) => n.textContent)
    })
    check(
      '关闭后只列 Markdown / HTML',
      !afterDisable.includes('pic.png') &&
        !afterDisable.includes('note.txt') &&
        afterDisable.includes('guide.md') &&
        afterDisable.includes('sample.html'),
      JSON.stringify(afterDisable),
    )
    await filePage.evaluate(() => {
      const sr = document.getElementById('markdown-reader-host').shadowRoot
      sr.querySelector('.mr-preview-close').click()
    })
    await filePage.waitForTimeout(250)
    await popup.close()
  } else {
    check('其他文件类型预览', false, '未找到扩展 service worker')
  }

  // 面包屑 + 筛选
  const crumbs = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return Array.from(sr.querySelectorAll('.mr-crumb')).map((n) => n.textContent)
  })
  check('面包屑', crumbs[crumbs.length - 1] === 'docs', crumbs.join('/'))

  const treeBaseline = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return Array.from(sr.querySelectorAll('.mr-tree > .mr-node')).filter((n) => !n.hidden).length
  })

  await filePage.fill('.mr-filter', 'gui').catch(() => {})
  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const input = sr.querySelector('.mr-filter')
    input.value = 'gui'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const filtered = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return Array.from(sr.querySelectorAll('.mr-tree > .mr-node'))
      .filter((n) => !n.hidden)
      .map((n) => n.querySelector('.mr-node-name')?.textContent)
  })
  check('文件名筛选', filtered.length === 1 && filtered[0] === 'guide.md', JSON.stringify(filtered))

  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const input = sr.querySelector('.mr-filter')
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const restored = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return Array.from(sr.querySelectorAll('.mr-tree > .mr-node')).filter((n) => !n.hidden).length
  })
  check('清空筛选恢复', restored === treeBaseline, `visible=${restored}/${treeBaseline}`)

  // 上一级
  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('.mr-up').click()
  })
  await filePage.waitForFunction(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const crumbs = sr.querySelectorAll('.mr-crumb')
    return crumbs.length > 0 && crumbs[crumbs.length - 1].textContent === 'test-artifacts'
  }, { timeout: 10_000 })
  const parentTree = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return Array.from(sr.querySelectorAll('.mr-tree > .mr-node .mr-node-name')).map(
      (n) => n.textContent,
    )
  })
  check('上一级目录', parentTree.includes('docs'), parentTree.join(','))
  await filePage.screenshot({ path: 'test-artifacts/file-tree.png' })

  // 回到 docs
  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const crumbs = Array.from(sr.querySelectorAll('.mr-crumb'))
    crumbs.find((c) => c.textContent === 'docs')?.click()
  })
  await filePage.waitForTimeout(400)

  const imgOk = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return sr.querySelector('.mr-article img')?.getAttribute('src')?.startsWith('data:image/svg+xml') ?? false
  })
  check('data URI 图片渲染', imgOk)

  // Mermaid（首次会懒加载 mermaid.js）
  await filePage.waitForFunction(
    () => {
      const sr = document.getElementById('markdown-reader-host').shadowRoot
      return !!sr.querySelector('.mr-mermaid.is-ready svg')
    },
    { timeout: 20_000 },
  )
  const mermaidInfo = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const block = sr.querySelector('.mr-mermaid')
    return { ready: block.classList.contains('is-ready'), nodes: block.querySelectorAll('svg g').length }
  })
  check('Mermaid 渲染', mermaidInfo.ready && mermaidInfo.nodes > 0, JSON.stringify(mermaidInfo))

  // 全文搜索
  await filePage.evaluate(() => {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true }),
    )
  })
  const findOpen = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return !sr.querySelector('.mr-find').hidden
  })
  check('Cmd+F 打开搜索', findOpen)

  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const input = sr.querySelector('.mr-find-input')
    input.value = '标题'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const findState = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return {
      count: sr.querySelector('.mr-find-count').textContent,
      highlights: CSS.highlights?.has('mr-find') ?? false,
    }
  })
  check('搜索命中与高亮', findState.count === '1/1' && findState.highlights, JSON.stringify(findState))
  await filePage.screenshot({ path: 'test-artifacts/find.png' })

  await filePage.evaluate(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  const findClosed = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return sr.querySelector('.mr-find').hidden && !CSS.highlights?.has('mr-find')
  })
  check('Esc 关闭并清理高亮', findClosed)

  // 两栏折叠：栏内按钮 + 工具栏开关，状态持久化
  const beforeCollapse = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const rect = sr.querySelector('.mr-article').getBoundingClientRect()
    return { width: rect.width, left: rect.left }
  })
  const widthExpanded = beforeCollapse.width
  const widthLeft = beforeCollapse.left

  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('.mr-sidebar-close').click()
  })
  const filesCollapsed = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return {
      hidden: sr.querySelector('.mr-sidebar').hidden,
      pressed: sr.querySelector('[data-act="files"]').getAttribute('aria-pressed'),
    }
  })
  check('收起文件树', filesCollapsed.hidden && filesCollapsed.pressed === 'false', JSON.stringify(filesCollapsed))

  // 收起后左侧腾出的空间交给正文：正文整体左移并在剩余空间里居中
  const reclaimed = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const rect = sr.querySelector('.mr-article').getBoundingClientRect()
    const col = sr.querySelector('.mr-layout').getBoundingClientRect()
    return { width: rect.width, left: rect.left, colLeft: col.left, colWidth: col.width }
  })
  check(
    '收起文件树后正文占满左列',
    reclaimed.left < widthLeft - 100 && reclaimed.width >= widthExpanded,
    JSON.stringify({ widthExpanded, widthLeft, ...reclaimed }),
  )

  await filePage.reload()
  await filePage.waitForFunction(() => !!document.getElementById('markdown-reader-host')?.shadowRoot)
  await filePage.waitForTimeout(400)
  const filesPersisted = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return sr.querySelector('.mr-sidebar').hidden
  })
  check('文件树折叠状态持久化', filesPersisted)

  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('[data-act="files"]').click()
  })
  await filePage.waitForTimeout(200)
  const filesShown = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return !sr.querySelector('.mr-sidebar').hidden
  })
  check('工具栏重新展开文件树', filesShown)

  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('.mr-toc-close').click()
  })
  await filePage.waitForTimeout(200)
  const tocCollapsed = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return {
      hidden: sr.querySelector('.mr-toc').hidden,
      pressed: sr.querySelector('[data-act="toc"]').getAttribute('aria-pressed'),
    }
  })
  check('收起目录', tocCollapsed.hidden && tocCollapsed.pressed === 'false', JSON.stringify(tocCollapsed))

  await filePage.reload()
  await filePage.waitForTimeout(600)
  const tocPersisted = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return sr.querySelector('.mr-toc').hidden
  })
  check('目录折叠状态持久化', tocPersisted)

  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('[data-act="toc"]').click()
  })
  await filePage.waitForTimeout(200)
  const tocShown = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return !sr.querySelector('.mr-toc').hidden
  })
  check('工具栏重新展开目录', tocShown)

  await filePage.waitForTimeout(300)

  // 窄屏（≤1000px）：文件树改成抽屉，能点开、能关掉，标题不与悬浮工具栏重叠
  await filePage.setViewportSize({ width: 900, height: 860 })
  await filePage.waitForTimeout(300)
  const narrowIdle = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const h1 = sr.querySelector('.mr-article h1').getBoundingClientRect()
    const bar = sr.querySelector('.mr-toolbar').getBoundingClientRect()
    return {
      sidebar: !sr.querySelector('.mr-sidebar').hidden,
      rail: !sr.querySelector('.mr-rail-left').hidden,
      gap: Math.round(h1.top - bar.bottom),
    }
  })
  check(
    '窄屏无侧栏但保留抽屉手柄',
    !narrowIdle.sidebar && narrowIdle.rail,
    JSON.stringify(narrowIdle),
  )
  check('窄屏标题不被工具栏遮挡', narrowIdle.gap >= 12, `gap=${narrowIdle.gap}`)

  const railArrows = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const d = (s) => sr.querySelector(s)?.querySelector('path')?.getAttribute('d') ?? ''
    return { left: d('.mr-rail-left'), right: d('.mr-rail-right') }
  })
  check(
    '展开手柄箭头朝面板方向',
    railArrows.left === 'M9 5l7 7-7 7' && railArrows.right === 'M15 5l-7 7 7 7',
    JSON.stringify(railArrows),
  )

  const narrowToc = await filePage.evaluate(async () => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const read = () => Math.round(sr.querySelector('.mr-article').getBoundingClientRect().width)
    const before = read()
    sr.querySelector('.mr-toc-close').click()
    await new Promise((r) => setTimeout(r, 200))
    return { before, after: read(), tocHidden: sr.querySelector('.mr-toc').hidden }
  })
  check(
    '窄屏折叠目录不压缩正文',
    narrowToc.tocHidden && narrowToc.after === narrowToc.before,
    JSON.stringify(narrowToc),
  )
  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('.mr-rail-right').click()
  })
  await filePage.waitForTimeout(200)

  await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    sr.querySelector('.mr-rail-left').click()
  })
  await filePage.waitForTimeout(320)
  const drawerOpen = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const sidebar = sr.querySelector('.mr-sidebar')
    const scrim = sr.querySelector('.mr-scrim')
    const rect = sidebar.getBoundingClientRect()
    return {
      sidebar: !sidebar.hidden,
      scrim: getComputedStyle(scrim).display !== 'none',
      left: Math.round(rect.left),
      width: Math.round(rect.width),
    }
  })
  check(
    '窄屏点手柄打开文件抽屉',
    drawerOpen.sidebar && drawerOpen.scrim && drawerOpen.left === 0 && drawerOpen.width > 200,
    JSON.stringify(drawerOpen),
  )

  // 3.x 被截断的文件名悬停补全
  const tipNode = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const el = [...sr.querySelectorAll('.mr-tree .mr-node-name')].find((n) => n.textContent.startsWith('a-very-long'))
    const box = el.getBoundingClientRect()
    return { x: box.left + Math.min(box.width / 2, 24), y: box.top + box.height / 2, truncated: el.scrollWidth > el.clientWidth + 1, text: el.textContent }
  })
  await filePage.mouse.move(tipNode.x, tipNode.y)
  await filePage.waitForTimeout(260)
  const tipShown = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    const tip = sr.querySelector('.mr-tip')
    const box = tip.getBoundingClientRect()
    return { hidden: tip.hidden, text: tip.textContent, onScreen: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight }
  })
  check(
    '截断的文件名悬停显示完整名字',
    tipNode.truncated && !tipShown.hidden && tipShown.text === tipNode.text && tipShown.onScreen,
    JSON.stringify({ tipNode, tipShown }),
  )
  await filePage.mouse.move(600, 500)
  await filePage.waitForTimeout(200)
  const tipHidden = await filePage.evaluate(
    () => document.getElementById('markdown-reader-host').shadowRoot.querySelector('.mr-tip').hidden,
  )
  check('移开鼠标收起文件名提示', tipHidden === true)

  await filePage.keyboard.press('Escape')
  await filePage.waitForTimeout(320)
  const drawerClosed = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return {
      sidebar: !sr.querySelector('.mr-sidebar').hidden,
      scrim: getComputedStyle(sr.querySelector('.mr-scrim')).display !== 'none',
      rail: !sr.querySelector('.mr-rail-left').hidden,
    }
  })
  check(
    'Esc 收起窄屏抽屉并恢复手柄',
    !drawerClosed.sidebar && !drawerClosed.scrim && drawerClosed.rail,
    JSON.stringify(drawerClosed),
  )

  await filePage.setViewportSize({ width: 1440, height: 900 })
  await filePage.waitForTimeout(300)
  await filePage.screenshot({ path: 'test-artifacts/file.png' })
} catch (error) {
  console.error('❌ 测试异常:', error.message)
  failed++
} finally {
  await ctx.close()
  server.close()
}

console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
