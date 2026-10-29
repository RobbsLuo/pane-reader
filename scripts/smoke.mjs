import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const EXT = resolve('dist')
const EXE =
  process.env.CHROME_PATH ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

const SAMPLE = `# Markdown Reader 冒烟测试

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
  res.writeHead(404).end()
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
mkdirSync('test-artifacts', { recursive: true })
mkdirSync('test-artifacts/docs/sub', { recursive: true })
writeFileSync('test-artifacts/docs/index.md', SAMPLE)
writeFileSync('test-artifacts/docs/guide.md', '# Guide\n\n第一篇。\n')
writeFileSync('test-artifacts/docs/sub/deep.md', '# Deep\n\n子目录文件。\n')
writeFileSync('test-artifacts/docs/notes.txt', 'not markdown')

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
  await page.screenshot({ path: 'test-artifacts/http.png' })

  const noTree = await page.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return {
      sidebarHidden: sr.querySelector('.mr-sidebar').hidden,
      filesButtonHidden: sr.querySelector('[data-act="files"]').hidden,
    }
  })
  check('无目录索引时隐藏文件树', noTree.sidebarHidden && noTree.filesButtonHidden, JSON.stringify(noTree))

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
      onlineTree.names.length === 3 &&
      onlineTree.dirFirst &&
      onlineTree.current === 1,
    JSON.stringify(onlineTree),
  )
  await dirPage.screenshot({ path: 'test-artifacts/http-tree.png' })

  // 4. file:// 本地 md
  const fileUrl = pathToFileURL(resolve('test-artifacts/docs/index.md')).href
  const filePage = await ctx.newPage()
  await filePage.goto(fileUrl)
  const fr = await inspect(filePage)
  check('本地 file:// .md', fr.h1.includes('冒烟测试'), fr.h1)

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
      !localTree.names.includes('notes.txt') &&
      localTree.dirFirst &&
      localTree.current === 1,
    JSON.stringify(localTree),
  )

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

  // 面包屑 + 筛选
  const crumbs = await filePage.evaluate(() => {
    const sr = document.getElementById('markdown-reader-host').shadowRoot
    return Array.from(sr.querySelectorAll('.mr-crumb')).map((n) => n.textContent)
  })
  check('面包屑', crumbs[crumbs.length - 1] === 'docs', crumbs.join('/'))

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
  check('清空筛选恢复', restored === 4, `visible=${restored}`)

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
