import DOMPurify from 'dompurify'
import katexCss from 'katex/dist/katex.min.css?inline'
import hljsLightCss from 'highlight.js/styles/github.css?inline'
import hljsDarkCss from 'highlight.js/styles/github-dark.css?inline'

import { readerCss } from './styles'
import { highlightCode, renderMarkdown } from './markdown'
import { resolveTheme, type Settings } from '../shared/settings'

interface DirEntry {
  name: string
  url: string
  type: 'file' | 'dir'
}

const ICONS = {
  files:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  toc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h13"/></svg>',
  theme:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  raw: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6l-5 6 5 6M16 6l5 6-5 6"/></svg>',
  folder:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>',
}

let mounted = false

function normalizePath(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname)
  } catch {
    return url
  }
}

export function mount(source: string, settings: Settings): void {
  if (mounted) return
  mounted = true

  const originalOverflow = document.documentElement.style.overflow

  const host = document.createElement('div')
  host.id = 'markdown-reader-host'
  host.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;overflow:auto;overscroll-behavior:contain;'

  const shadow = host.attachShadow({ mode: 'open' })

  const baseStyle = document.createElement('style')
  baseStyle.textContent = readerCss + katexCss

  const lightTheme = document.createElement('style')
  lightTheme.textContent = hljsLightCss

  const darkTheme = document.createElement('style')
  darkTheme.textContent = hljsDarkCss

  const root = document.createElement('div')
  root.className = 'mr-root'
  root.innerHTML = `
    <div class="mr-toolbar" role="toolbar" aria-label="Markdown Reader">
      <button type="button" data-act="files" title="文件目录" hidden>${ICONS.files}</button>
      <button type="button" data-act="toc" title="显示 / 隐藏目录">${ICONS.toc}</button>
      <button type="button" data-act="theme" title="切换主题">${ICONS.theme}</button>
      <span class="mr-sep"></span>
      <button type="button" data-act="font-minus" title="减小字号">A−</button>
      <button type="button" data-act="font-plus" title="增大字号">A+</button>
      <span class="mr-sep"></span>
      <button type="button" data-act="raw" title="查看 Markdown 源码">${ICONS.raw}</button>
    </div>
    <div class="mr-layout">
      <aside class="mr-sidebar" hidden>
        <div class="mr-sidebar-head">
          <button type="button" class="mr-up" title="上一级">↑</button>
          <span class="mr-sidebar-title"></span>
          <button type="button" class="mr-sidebar-close" title="收起文件目录">×</button>
        </div>
        <input class="mr-filter" type="search" placeholder="筛选文件" spellcheck="false" />
        <div class="mr-breadcrumb"></div>
        <div class="mr-tree" role="tree"></div>
      </aside>
      <article class="mr-article"></article>
      <pre class="mr-source" hidden></pre>
      <aside class="mr-toc">
        <div class="mr-toc-title">目录</div>
        <nav></nav>
      </aside>
    </div>
    <div class="mr-find" hidden>
      <input class="mr-find-input" type="text" placeholder="查找" spellcheck="false" />
      <span class="mr-find-count"></span>
      <button type="button" class="mr-find-prev" title="上一个 (Shift+Enter)" aria-label="上一个">↑</button>
      <button type="button" class="mr-find-next" title="下一个 (Enter)" aria-label="下一个">↓</button>
      <button type="button" class="mr-find-close" title="关闭 (Esc)" aria-label="关闭">×</button>
    </div>
    <div class="mr-lightbox" hidden><img alt=""></div>
  `

  shadow.append(baseStyle, lightTheme, darkTheme, root)

  const article = root.querySelector<HTMLElement>('.mr-article')!
  const sourceView = root.querySelector<HTMLElement>('.mr-source')!
  sourceView.textContent = source
  const toc = root.querySelector<HTMLElement>('.mr-toc')!
  const tocNav = toc.querySelector('nav')!
  const sidebar = root.querySelector<HTMLElement>('.mr-sidebar')!
  const sidebarTitle = sidebar.querySelector<HTMLElement>('.mr-sidebar-title')!
  const tree = sidebar.querySelector<HTMLElement>('.mr-tree')!
  const breadcrumb = sidebar.querySelector<HTMLElement>('.mr-breadcrumb')!
  const filterInput = sidebar.querySelector<HTMLInputElement>('.mr-filter')!
  const upButton = sidebar.querySelector<HTMLButtonElement>('.mr-up')!
  const lightbox = root.querySelector<HTMLElement>('.mr-lightbox')!
  const lightboxImg = lightbox.querySelector('img')!
  const toolbar = root.querySelector<HTMLElement>('.mr-toolbar')!
  const filesButton = toolbar.querySelector<HTMLButtonElement>('[data-act="files"]')!

  const findBar = root.querySelector<HTMLElement>('.mr-find')!
  const findInput = findBar.querySelector<HTMLInputElement>('.mr-find-input')!
  const findCount = findBar.querySelector<HTMLElement>('.mr-find-count')!

  // ---- 渲染 ----
  const sanitized = DOMPurify.sanitize(renderMarkdown(source), {
    USE_PROFILES: { html: true, mathMl: true, svg: true, svgFilters: true },
    ADD_ATTR: ['target', 'loading', 'decoding', 'align'],
  })
  article.innerHTML = sanitized
  observeHighlight()
  observeMermaid()

  // 代码块复制按钮
  for (const pre of article.querySelectorAll('pre')) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'mr-copy'
    button.textContent = '复制'
    button.addEventListener('click', async () => {
      const text = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
      try {
        await navigator.clipboard.writeText(text)
        button.textContent = '已复制'
      } catch {
        button.textContent = '复制失败'
      }
      setTimeout(() => (button.textContent = '复制'), 1200)
    })
    pre.append(button)
  }

  // 图片灯箱
  article.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.tagName === 'IMG') {
      lightboxImg.src = (target as HTMLImageElement).src
      lightbox.hidden = false
    }
  })
  lightbox.addEventListener('click', () => {
    lightbox.hidden = true
    lightboxImg.src = ''
  })

  // ---- 目录 ----
  const headings = Array.from(
    article.querySelectorAll<HTMLElement>('h1, h2, h3, h4'),
  ).filter((el) => el.id && (el.textContent ?? '').trim())

  // 长文档标题可能上千个：用片段批量插入 + 事件委托，避免逐个绑定监听器
  const tocFragment = document.createDocumentFragment()
  for (const heading of headings) {
    const link = document.createElement('a')
    link.href = `#${heading.id}`
    link.textContent = heading.textContent!.trim()
    link.dataset.level = heading.tagName.slice(1)
    link.dataset.target = heading.id
    tocFragment.append(link)
  }
  tocNav.append(tocFragment)

  tocNav.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest('a')
    if (!link) return
    event.preventDefault()
    const id = link.dataset.target
    const heading = id ? document.getElementById(id) : null
    if (!heading) return
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
    try {
      history.replaceState(null, '', `#${id}`)
    } catch {
      /* file:// 等场景可能禁止修改 history */
    }
  })

  const tocLinks = Array.from(tocNav.querySelectorAll<HTMLAnchorElement>('a'))
  let ticking = false
  host.addEventListener(
    'scroll',
    () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const top = 96
        let activeIndex = 0
        headings.forEach((heading, index) => {
          if (heading.getBoundingClientRect().top <= top) activeIndex = index
        })
        tocLinks.forEach((link, index) =>
          link.classList.toggle('is-active', index === activeIndex),
        )
      })
    },
    { passive: true },
  )

  // ---- Mermaid ----
  let activeTheme: 'light' | 'dark' = 'light'
  let mermaidFrame: HTMLIFrameElement | null = null
  let mermaidFrameReady: Promise<HTMLIFrameElement> | null = null
  const mermaidPending = new Map<
    string,
    { resolve: (svg: string) => void; reject: (error: Error) => void }
  >()

  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as
      | { type?: string; id?: string; svg?: string; error?: string }
      | null
    if (!data || data.type !== 'mr-mermaid-result' || !data.id) return

    const pending = mermaidPending.get(data.id)
    if (!pending) return
    mermaidPending.delete(data.id)

    if (data.error) pending.reject(new Error(data.error))
    else pending.resolve(data.svg ?? '')
  })

  function ensureMermaidFrame(): Promise<HTMLIFrameElement> {
    if (mermaidFrame) return Promise.resolve(mermaidFrame)
    if (mermaidFrameReady) return mermaidFrameReady

    mermaidFrameReady = new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe')
      iframe.src = chrome.runtime.getURL('mermaid-frame.html')
      iframe.title = 'Mermaid'
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.cssText =
        'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none'

      const timer = setTimeout(() => reject(new Error('图表渲染器加载超时')), 10_000)
      iframe.onload = () => {
        clearTimeout(timer)
        mermaidFrame = iframe
        resolve(iframe)
      }
      iframe.onerror = () => {
        clearTimeout(timer)
        reject(new Error('无法加载图表渲染器'))
      }
      document.documentElement.append(iframe)
    })

    return mermaidFrameReady
  }

  async function renderInFrame(code: string, theme: 'light' | 'dark'): Promise<string> {
    const iframe = await ensureMermaidFrame()
    const id = `mmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        mermaidPending.delete(id)
        reject(new Error('图表渲染超时'))
      }, 15_000)

      mermaidPending.set(id, {
        resolve: (svg) => {
          clearTimeout(timer)
          resolve(svg)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })

      iframe.contentWindow?.postMessage({ type: 'mr-mermaid-render', id, code, theme }, '*')
    })
  }

  async function renderMermaidBlock(block: HTMLElement): Promise<void> {
    let code = ''
    try {
      code = decodeURIComponent(block.dataset.code ?? '')
    } catch {
      return
    }
    if (!code.trim()) return

    block.classList.remove('is-error')
    block.classList.add('is-loading')

    const holder = document.createElement('div')
    block.append(holder)
    try {
      const svg = await renderInFrame(code, activeTheme)
      holder.remove()
      // mermaid 用 securityLevel=strict 渲染（内部已过 DOMPurify，且禁用脚本与 click 回调）。
      // 这里不能再清洗一次：DOMPurify 会移除 foreignObject 里的文字，图表标签会全部丢失。
      block.innerHTML = svg
      block.classList.add('is-ready')
    } catch (error) {
      holder.remove()
      block.classList.add('is-error')
      block.textContent = `Mermaid 渲染失败：${(error as Error).message}`
    } finally {
      block.classList.remove('is-loading')
    }
  }

  function observeHighlight(): void {
    const blocks = Array.from(article.querySelectorAll<HTMLElement>('pre.hljs[data-lang]'))
    if (!blocks.length) return

    const paint = (pre: HTMLElement) => {
      const codeEl = pre.querySelector('code')
      const lang = pre.dataset.lang
      if (!codeEl || !lang) return
      codeEl.innerHTML = highlightCode(codeEl.textContent ?? '', lang)
      delete pre.dataset.lang
    }

    if (!('IntersectionObserver' in window)) {
      for (const block of blocks) paint(block)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          observer.unobserve(entry.target)
          paint(entry.target as HTMLElement)
        }
      },
      { rootMargin: '600px 0px' },
    )
    for (const block of blocks) observer.observe(block)
  }

  function observeMermaid(): void {
    const blocks = Array.from(article.querySelectorAll<HTMLElement>('.mr-mermaid'))
    if (!blocks.length) return

    if (!('IntersectionObserver' in window)) {
      for (const block of blocks) void renderMermaidBlock(block)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          observer.unobserve(entry.target)
          void renderMermaidBlock(entry.target as HTMLElement)
        }
      },
      { rootMargin: '400px 0px' },
    )
    for (const block of blocks) observer.observe(block)
  }

  function refreshMermaid(): void {
    for (const block of article.querySelectorAll<HTMLElement>('.mr-mermaid.is-ready')) {
      block.classList.remove('is-ready')
      void renderMermaidBlock(block)
    }
  }

  // ---- 全文搜索 ----
  let findMatches: Range[] = []
  let findIndex = 0

  function highlightRegistry(): HighlightRegistry | null {
    const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS
    return css?.highlights ?? null
  }

  function collectTextNodes(rootEl: HTMLElement): Text[] {
    const nodes: Text[] = []
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = (node as Text).parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        const tag = parent.tagName
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
          return NodeFilter.FILTER_REJECT
        }
        if (parent.closest('.katex-mathml')) return NodeFilter.FILTER_REJECT
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push(node as Text)
    }
    return nodes
  }

  function findInArticle(query: string): Range[] {
    const needle = query.trim().toLowerCase()
    if (!needle) return []

    const ranges: Range[] = []
    for (const node of collectTextNodes(article)) {
      const haystack = node.data.toLowerCase()
      let at = haystack.indexOf(needle)
      while (at !== -1) {
        const range = document.createRange()
        range.setStart(node, at)
        range.setEnd(node, at + needle.length)
        ranges.push(range)
        at = haystack.indexOf(needle, at + needle.length)
      }
    }
    return ranges
  }

  function clearFindHighlights(): void {
    const registry = highlightRegistry()
    registry?.delete('mr-find')
    registry?.delete('mr-find-current')
  }

  function paintFind(): void {
    const registry = highlightRegistry()
    if (!registry || typeof Highlight === 'undefined') return

    if (!findMatches.length) {
      clearFindHighlights()
      return
    }

    registry.set('mr-find', new Highlight(...findMatches))
    registry.set('mr-find-current', new Highlight(findMatches[findIndex]))

    const rect = findMatches[findIndex].getBoundingClientRect()
    if (rect.top < 96 || rect.bottom > window.innerHeight - 48) {
      window.scrollTo({
        top: window.scrollY + rect.top - window.innerHeight / 2,
        behavior: 'smooth',
      })
    }
  }

  function updateFindCount(query: string): void {
    if (!query.trim()) {
      findCount.textContent = ''
      return
    }
    findCount.textContent = findMatches.length ? `${findIndex + 1}/${findMatches.length}` : '0/0'
  }

  function runFind(query: string): void {
    findMatches = findInArticle(query)
    findIndex = 0
    updateFindCount(query)
    paintFind()
  }

  function stepFind(delta: number): void {
    if (!findMatches.length) return
    findIndex = (findIndex + delta + findMatches.length) % findMatches.length
    updateFindCount(findInput.value)
    paintFind()
  }

  function openFind(): void {
    if (!findBar.hidden) {
      findInput.select()
      return
    }
    findBar.hidden = false
    findInput.focus()
    findInput.select()
    runFind(findInput.value)
  }

  function closeFind(): void {
    if (findBar.hidden) return
    findBar.hidden = true
    findMatches = []
    findIndex = 0
    findCount.textContent = ''
    clearFindHighlights()
  }

  findInput.addEventListener('input', () => runFind(findInput.value))
  findInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      stepFind(event.shiftKey ? -1 : 1)
    }
  })
  findBar.querySelector('.mr-find-prev')!.addEventListener('click', () => stepFind(-1))
  findBar.querySelector('.mr-find-next')!.addEventListener('click', () => stepFind(1))
  findBar.querySelector('.mr-find-close')!.addEventListener('click', closeFind)

  window.addEventListener(
    'keydown',
    (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        openFind()
        return
      }
      if (event.key === 'Escape') closeFind()
    },
    true,
  )

  // ---- 文件目录树 ----
  let hasTree = false
  let showFiles = true
  let current = settings
  let rawMode = false

  async function requestDirectory(url: string): Promise<DirEntry[]> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'mr:listDir',
        url,
      })
      return response?.ok ? (response.entries as DirEntry[]) : []
    } catch {
      return []
    }
  }

  function renderNodes(container: HTMLElement, entries: DirEntry[], depth: number): void {
    const here = normalizePath(location.href)

    for (const entry of entries) {
      const node = document.createElement('div')
      node.className = 'mr-node'
      node.dataset.type = entry.type
      node.setAttribute('role', 'treeitem')

      const row = document.createElement('div')
      row.className = 'mr-node-row'
      row.style.paddingLeft = `${8 + depth * 12}px`

      if (entry.type === 'dir') {
        const caret = document.createElement('button')
        caret.type = 'button'
        caret.className = 'mr-caret'
        caret.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
        caret.setAttribute('aria-label', '展开')
        row.append(caret)
      } else {
        const spacer = document.createElement('span')
        spacer.className = 'mr-caret-spacer'
        row.append(spacer)
      }

      const icon = document.createElement('span')
      icon.className = 'mr-icon'
      icon.innerHTML = entry.type === 'dir' ? ICONS.folder : ICONS.file
      row.append(icon)

      const name = document.createElement(entry.type === 'dir' ? 'span' : 'a')
      name.className = 'mr-node-name'
      name.textContent = entry.name
      name.title = entry.name
      if (entry.type === 'file') {
        ;(name as HTMLAnchorElement).href = entry.url
        if (normalizePath(entry.url) === here) {
          name.setAttribute('aria-current', 'page')
          node.classList.add('is-current')
        }
      }
      row.append(name)

      node.append(row)
      container.append(node)

      if (entry.type === 'dir') {
        const children = document.createElement('div')
        children.className = 'mr-children'
        children.hidden = true
        node.append(children)

        row.addEventListener('click', async (event) => {
          // 点目录名也走展开，不跳转到目录索引页
          event.preventDefault()
          const open = node.classList.toggle('open')
          children.hidden = !open
          if (!open || children.dataset.loaded === '1') return

          children.dataset.loaded = '1'
          const nested = await requestDirectory(entry.url)
          if (!nested.length) {
            const empty = document.createElement('div')
            empty.className = 'mr-node-empty'
            empty.textContent = '（空）'
            empty.style.paddingLeft = `${8 + (depth + 1) * 12}px`
            children.append(empty)
            return
          }
          renderNodes(children, nested, depth + 1)
        })
      }
    }
  }

  function decodePath(value: string): string {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  /** 取路径前 count 段，拼回目录 URL（file:// 的 origin 是 null，不能用 origin 拼） */
  function dirUrlAt(url: URL, count: number): string {
    const parts = url.pathname.split('/').filter(Boolean).slice(0, count)
    const next = new URL(url.href)
    next.pathname = `/${parts.join('/')}/`
    next.search = ''
    next.hash = ''
    return next.href
  }

  function renderBreadcrumb(url: URL): void {
    breadcrumb.replaceChildren()
    const parts = url.pathname.split('/').filter(Boolean)
    if (!parts.length) return

    // 路径太深时只显示最后 2 段
    const start = Math.max(0, parts.length - 2)
    if (start > 0) {
      const gap = document.createElement('span')
      gap.className = 'mr-crumb-gap'
      gap.textContent = '… /'
      breadcrumb.append(gap)
    }

    for (let index = start; index < parts.length; index += 1) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'mr-crumb'
      button.textContent = decodePath(parts[index])
      button.title = decodePath(parts.slice(0, index + 1).join('/'))
      if (index === parts.length - 1) {
        button.classList.add('is-current')
      } else {
        button.addEventListener('click', () => void loadRoot(dirUrlAt(url, index + 1)))
      }
      breadcrumb.append(button)

      if (index < parts.length - 1) {
        const separator = document.createElement('span')
        separator.className = 'mr-crumb-sep'
        separator.textContent = '/'
        breadcrumb.append(separator)
      }
    }
  }

  function applyFilter(rawQuery: string): void {
    const query = rawQuery.trim().toLowerCase()
    const nodes = Array.from(tree.querySelectorAll<HTMLElement>('.mr-node')).reverse()

    if (!query) {
      for (const node of nodes) node.hidden = false
      return
    }

    for (const node of nodes) {
      const name =
        node.querySelector<HTMLElement>(':scope > .mr-node-row .mr-node-name')?.textContent ?? ''
      const selfMatch = name.toLowerCase().includes(query)
      const childMatch = !!node.querySelector<HTMLElement>('.mr-children .mr-node:not([hidden])')

      node.hidden = !selfMatch && !childMatch

      if (childMatch) {
        const children = node.querySelector<HTMLElement>(':scope > .mr-children')
        if (children) children.hidden = false
        node.classList.add('open')
      }
    }
  }

  let rootUrl = new URL('.', location.href).href

  async function loadRoot(dirUrl: string): Promise<void> {
    const entries = await requestDirectory(dirUrl)
    if (!entries.length) {
      hasTree = false
      filesButton.hidden = true
      apply(current)
      return
    }

    const url = new URL(dirUrl)
    const parts = url.pathname.split('/').filter(Boolean)
    const hasParent = parts.length > 1

    // 只有一个文件、又没有上级可看时，树没有意义
    if (entries.length === 1 && entries[0].type === 'file' && !hasParent) {
      hasTree = false
      filesButton.hidden = true
      apply(current)
      return
    }

    rootUrl = url.href
    sidebarTitle.textContent = decodePath(parts[parts.length - 1] ?? '') || '文件'
    sidebarTitle.title = url.href
    upButton.hidden = !hasParent
    filterInput.value = ''

    tree.replaceChildren()
    renderNodes(tree, entries, 0)
    renderBreadcrumb(url)

    hasTree = true
    filesButton.hidden = false
    apply(current)
  }

  upButton.addEventListener('click', () => {
    const url = new URL(rootUrl)
    const count = url.pathname.split('/').filter(Boolean).length
    if (count > 1) void loadRoot(dirUrlAt(url, count - 1))
  })

  filterInput.addEventListener('input', () => applyFilter(filterInput.value))

  // ---- 设置应用 ----
  function apply(settings: Settings): void {
    const theme = resolveTheme(settings.theme)
    const themeChanged = activeTheme !== theme
    activeTheme = theme
    root.dataset.theme = theme
    lightTheme.disabled = theme === 'dark'
    darkTheme.disabled = theme !== 'dark'
    root.style.setProperty('--mr-font-size', `${settings.fontSize}px`)
    toc.hidden = rawMode || !settings.showToc || headings.length < 2
    sidebar.hidden = !hasTree || !showFiles || rawMode
    filesButton.setAttribute('aria-pressed', String(hasTree && showFiles))
    const tocButton = toolbar.querySelector<HTMLButtonElement>('[data-act="toc"]')!
    tocButton.setAttribute('aria-pressed', String(settings.showToc))
    if (themeChanged) refreshMermaid()
  }
  apply(settings)

  // ---- 工具栏交互 ----
  toolbar.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('button')
    if (!button) return
    const act = button.dataset.act

    switch (act) {
      case 'files':
        showFiles = !showFiles
        apply(current)
        break
      case 'toc':
        current = { ...current, showToc: !current.showToc }
        apply(current)
        void persist(current)
        break
      case 'theme': {
        const now = resolveTheme(current.theme)
        current = { ...current, theme: now === 'dark' ? 'light' : 'dark' }
        apply(current)
        void persist(current)
        break
      }
      case 'font-minus':
      case 'font-plus': {
        const delta = act === 'font-plus' ? 1 : -1
        const size = Math.min(22, Math.max(13, current.fontSize + delta))
        current = { ...current, fontSize: size }
        apply(current)
        void persist(current)
        break
      }
      case 'raw':
        rawMode = !rawMode
        button.setAttribute('aria-pressed', String(rawMode))
        article.hidden = rawMode
        sourceView.hidden = !rawMode
        apply(current)
        host.scrollTop = 0
        break
    }
  })

  sidebar.querySelector('.mr-sidebar-close')!.addEventListener('click', () => {
    showFiles = false
    apply(current)
  })

  function persist(settings: Settings): Promise<void> {
    return chrome.storage.local.set({ settings }).catch(() => undefined)
  }

  // 设置由 popup 改动时同步
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return
    current = { ...current, ...(changes.settings.newValue ?? {}) }
    apply(current)
  })

  // 跟随系统主题
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => apply(current))

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !lightbox.hidden) {
      lightbox.hidden = true
      lightboxImg.src = ''
    }
  })

  // ---- 接管页面 ----
  document.documentElement.style.overflow = 'hidden'
  document.body.replaceChildren(host)

  void loadRoot(new URL('.', location.href).href)

  window.addEventListener('pagehide', () => {
    document.documentElement.style.overflow = originalOverflow
  })
}
