import DOMPurify from 'dompurify'
import chevronLeftIcon from 'lucide-static/icons/chevron-left.svg?raw'
import chevronRightIcon from 'lucide-static/icons/chevron-right.svg?raw'
import codeXmlIcon from 'lucide-static/icons/code-xml.svg?raw'
import fileAudioIcon from 'lucide-static/icons/file-audio.svg?raw'
import fileBracesIcon from 'lucide-static/icons/file-braces.svg?raw'
import fileCodeIcon from 'lucide-static/icons/file-code.svg?raw'
import fileIcon from 'lucide-static/icons/file.svg?raw'
import fileImageIcon from 'lucide-static/icons/file-image.svg?raw'
import fileTextIcon from 'lucide-static/icons/file-text.svg?raw'
import fileTypeIcon from 'lucide-static/icons/file-type.svg?raw'
import fileVideoIcon from 'lucide-static/icons/file-video.svg?raw'
import folderIcon from 'lucide-static/icons/folder.svg?raw'
import folderTreeIcon from 'lucide-static/icons/folder-tree.svg?raw'
import listTreeIcon from 'lucide-static/icons/list-tree.svg?raw'
import sunMoonIcon from 'lucide-static/icons/sun-moon.svg?raw'
import katexCss from 'katex/dist/katex.min.css?inline'
import hljsLightCss from 'highlight.js/styles/github.css?inline'
import hljsDarkCss from 'highlight.js/styles/github-dark.css?inline'

import { readerCss } from './styles'
import { highlightCode, renderMarkdown, splitFrontMatter } from './markdown'
import { resolveTheme, type Settings } from '../shared/settings'

interface DirEntry {
  name: string
  url: string
  type: 'file' | 'dir'
  kind?: FileKind
}

type FileKind = 'md' | 'html' | 'image' | 'media' | 'pdf' | 'text'

const HTML_EXT = /\.(?:html?|xhtml)$/i

// DOMPurify 默认 URI 白名单不含 file:，本地 md 里的相对图片/附件会被整条
// 属性清掉（img.src 变空）。这里在默认规则上补一个 file:。
const SAFE_URI = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|file):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i

/** front matter 面板：直接建 DOM，不经过 sanitize */
function buildMetaPanel(entries: { key: string; value: string }[]): HTMLElement {
  const details = document.createElement('details')
  details.className = 'mr-meta'
  const summary = document.createElement('summary')
  summary.textContent = `文档属性 · ${entries.length} 项`
  const list = document.createElement('dl')
  for (const { key, value } of entries) {
    const dt = document.createElement('dt')
    dt.textContent = key || '—'
    const dd = document.createElement('dd')
    dd.textContent = value
    list.append(dt, dd)
  }
  details.append(summary, list)
  return details
}

// ---- 阅读位置记忆：同一文件再次打开/刷新后回到上次位置 ----
const SCROLL_KEY = 'scrollPositions'
const SCROLL_LIMIT = 300
const SCROLL_TTL = 30 * 24 * 60 * 60 * 1000

type ScrollMap = Record<string, { top: number; at: number }>

function pageKey(href = location.href): string {
  try {
    const url = new URL(href)
    url.hash = ''
    url.search = ''
    return url.href
  } catch {
    return href
  }
}

async function readScrollMap(): Promise<ScrollMap> {
  try {
    const stored = await chrome.storage.local.get(SCROLL_KEY)
    return (stored[SCROLL_KEY] ?? {}) as ScrollMap
  } catch {
    return {}
  }
}

function writeScrollMap(map: ScrollMap): Promise<void> {
  const now = Date.now()
  const entries = Object.entries(map)
    .filter(([, value]) => now - value.at < SCROLL_TTL)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, SCROLL_LIMIT)
  return chrome.storage.local
    .set({ [SCROLL_KEY]: Object.fromEntries(entries) })
    .catch(() => undefined)
}
// 预览里必须能点按钮，所以始终给 allow-scripts。
// same-origin 按来源区分：
//  - file:// 预览：父页面本身也是 file://，不给 same-origin 就连同目录的图片、外链 CSS
//    都加载不出来（Chrome 拦掉不透明源的 file:// 子资源），所以保留。
//  - http(s) 预览：绝不给 same-origin，否则被预览页面能读站点 cookie 和父页面 DOM；
//    远程的相对资源不依赖 same-origin，照常加载。
const HTML_SANDBOX_BASE =
  'allow-scripts allow-forms allow-popups allow-modals allow-downloads'

function htmlSandbox(url: string): string {
  try {
    return new URL(url).protocol === 'file:'
      ? `${HTML_SANDBOX_BASE} allow-same-origin`
      : HTML_SANDBOX_BASE
  } catch {
    return HTML_SANDBOX_BASE
  }
}

// 图标来自 lucide-static（ISC）：统一 24 网格、2px 描边，颜色全部走 currentColor。
// ?raw 只打进实际用到的十几个文件，不会拖入整包。
/** 去掉许可证注释，补上无障碍属性；尺寸和描边宽度由 CSS 决定 */
function icon(raw: string): string {
  return raw
    .replace(/^<!--[\s\S]*?-->\s*/, '')
    .replace('<svg', '<svg aria-hidden="true" focusable="false"')
}

const ICONS = {
  files: icon(folderTreeIcon),
  toc: icon(listTreeIcon),
  theme: icon(sunMoonIcon),
  raw: icon(codeXmlIcon),
  chevronLeft: icon(chevronLeftIcon),
  chevronRight: icon(chevronRightIcon),
  folder: icon(folderIcon),
  file: icon(fileIcon),
  md: icon(fileTextIcon),
  html: icon(fileCodeIcon),
  image: icon(fileImageIcon),
  pdf: icon(fileTypeIcon),
  text: icon(fileBracesIcon),
  media: icon(fileVideoIcon),
  audio: icon(fileAudioIcon),
}

let mounted = false

function normalizePath(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname)
  } catch {
    return url
  }
}

export function mount(
  source: string,
  settings: Settings,
  initial?: DirEntry,
  initialText?: string,
): void {
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
    <div class="mr-toolbar" role="toolbar" aria-label="Pane Reader">
      <span class="mr-brand" aria-hidden="true">pr</span>
      <span class="mr-toolbar-name">Pane Reader</span>
      <span class="mr-toolbar-doc"></span>
      <span class="mr-toolbar-spacer"></span>
      <button type="button" data-act="files" title="文件目录" aria-label="显示 / 隐藏文件目录" hidden>${ICONS.files}</button>
      <button type="button" data-act="toc" title="显示 / 隐藏目录" aria-label="显示 / 隐藏目录">${ICONS.toc}</button>
      <button type="button" data-act="theme" title="切换主题" aria-label="切换主题">${ICONS.theme}</button>
      <span class="mr-sep"></span>
      <button type="button" data-act="font-minus" title="减小字号" aria-label="减小字号">A−</button>
      <button type="button" data-act="font-plus" title="增大字号" aria-label="增大字号">A+</button>
      <span class="mr-sep"></span>
      <button type="button" data-act="raw" title="查看 Markdown 源码" aria-label="查看 Markdown 源码">${ICONS.raw}</button>
    </div>
    <div class="mr-layout">
      <aside class="mr-sidebar" hidden>
        <div class="mr-sidebar-head">
          <button type="button" class="mr-up" title="上一级">↑</button>
          <span class="mr-sidebar-title"></span>
          <button type="button" class="mr-collapse mr-sidebar-close" title="收起文件目录" aria-label="收起文件目录">${ICONS.chevronLeft}</button>
        </div>
        <input class="mr-filter" type="search" placeholder="筛选文件" spellcheck="false" />
        <div class="mr-breadcrumb"></div>
        <div class="mr-tree" role="tree"></div>
      </aside>
      <article class="mr-article"></article>
      <pre class="mr-source" hidden></pre>
      <div class="mr-preview" hidden>
        <div class="mr-preview-bar">
          <span class="mr-preview-name"></span>
          <span class="mr-preview-meta"></span>
          <button type="button" class="mr-preview-wrap" title="长行折行" aria-pressed="false" hidden>折行</button>
          <a class="mr-preview-open" target="_blank" rel="noopener noreferrer">新标签打开</a>
          <button type="button" class="mr-preview-close mr-panel-close" title="关闭预览 (Esc)" aria-label="关闭预览">×</button>
        </div>
        <div class="mr-preview-stage">
          <iframe
            class="mr-preview-frame"
            title="文件预览"
            sandbox="${HTML_SANDBOX_BASE}"
          ></iframe>
          <div class="mr-image-wrap" hidden>
            <img class="mr-preview-image" alt="" />
          </div>
          <pre class="mr-preview-text" hidden></pre>
          <div class="mr-media-wrap" hidden></div>
        </div>
      </div>
      <button type="button" class="mr-rail mr-rail-left" title="展开文件目录" aria-label="展开文件目录" hidden>${ICONS.chevronRight}</button>
      <aside class="mr-toc">
        <div class="mr-toc-head">
          <span class="mr-toc-title">目录</span>
          <button type="button" class="mr-collapse mr-toc-close" title="收起目录" aria-label="收起目录">${ICONS.chevronRight}</button>
        </div>
        <nav></nav>
      </aside>
      <button type="button" class="mr-rail mr-rail-right" title="展开目录" aria-label="展开目录" hidden>${ICONS.chevronLeft}</button>
    </div>
    <div class="mr-scrim"></div>
    <div class="mr-tip" role="tooltip" hidden></div>
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
  const toolbarDoc = toolbar.querySelector<HTMLElement>('.mr-toolbar-doc')!
  // 顶栏右侧显示当前文件名（file: 与 http: 都取路径最后一段）
  try {
    const name = decodeURIComponent(
      new URL(location.href).pathname.split('/').filter(Boolean).pop() ?? '',
    )
    toolbarDoc.textContent = name
    toolbarDoc.title = name
  } catch {
    toolbarDoc.remove()
  }
  const filesButton = toolbar.querySelector<HTMLButtonElement>('[data-act="files"]')!
  const rawButton = toolbar.querySelector<HTMLButtonElement>('[data-act="raw"]')!
  const preview = root.querySelector<HTMLElement>('.mr-preview')!
  const previewFrame = preview.querySelector<HTMLIFrameElement>('.mr-preview-frame')!
  const previewName = preview.querySelector<HTMLElement>('.mr-preview-name')!
  const previewMeta = preview.querySelector<HTMLElement>('.mr-preview-meta')!
  const previewWrap = preview.querySelector<HTMLButtonElement>('.mr-preview-wrap')!
  const previewImageWrap = preview.querySelector<HTMLElement>('.mr-image-wrap')!
  const previewImage = preview.querySelector<HTMLImageElement>('.mr-preview-image')!
  const previewText = preview.querySelector<HTMLElement>('.mr-preview-text')!
  const previewMedia = preview.querySelector<HTMLElement>('.mr-media-wrap')!
  const previewOpen = preview.querySelector<HTMLAnchorElement>('.mr-preview-open')!
  const previewClose = preview.querySelector<HTMLButtonElement>('.mr-preview-close')!
  const railLeft = root.querySelector<HTMLButtonElement>('.mr-rail-left')!
  const railRight = root.querySelector<HTMLButtonElement>('.mr-rail-right')!
  const scrim = root.querySelector<HTMLElement>('.mr-scrim')!
  const tip = root.querySelector<HTMLElement>('.mr-tip')!

  const findBar = root.querySelector<HTMLElement>('.mr-find')!
  const findInput = findBar.querySelector<HTMLInputElement>('.mr-find-input')!
  const findCount = findBar.querySelector<HTMLElement>('.mr-find-count')!

  // ---- 渲染 ----
  let activeTheme: 'light' | 'dark' = 'light'
  let docSource = source
  let docUrl = new URL(location.href)
  let headings: HTMLElement[] = []
  let tocLinks: HTMLAnchorElement[] = []
  // 文章在 shadow DOM 里，document.getElementById 查不到，必须走本地映射
  const headingById = new Map<string, HTMLElement>()

  /** 渲染一篇 Markdown（首屏与树里切换共用，不整页刷新） */
  function renderArticle(text: string): void {
    const { body, entries } = splitFrontMatter(text)
    const sanitized = DOMPurify.sanitize(renderMarkdown(body), {
      USE_PROFILES: { html: true, mathMl: true, svg: true, svgFilters: true },
      ADD_ATTR: ['target', 'loading', 'decoding', 'align'],
      ALLOWED_URI_REGEXP: SAFE_URI,
    })
    article.innerHTML = sanitized
    if (entries.length > 0) article.prepend(buildMetaPanel(entries))
    observeHighlight()
    observeMermaid()

    // 代码块复制按钮
    for (const pre of article.querySelectorAll('pre')) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'mr-copy'
      button.textContent = '复制'
      button.addEventListener('click', async () => {
        const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
        try {
          await navigator.clipboard.writeText(code)
          button.textContent = '已复制'
        } catch {
          button.textContent = '复制失败'
        }
        setTimeout(() => (button.textContent = '复制'), 1200)
      })
      pre.append(button)
    }

    headings = Array.from(
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
    tocNav.replaceChildren(tocFragment)
    tocLinks = Array.from(tocNav.querySelectorAll<HTMLAnchorElement>('a'))

    headingById.clear()
    for (const heading of headings) headingById.set(heading.id, heading)
    requestAnimationFrame(syncActive)
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

  // 滚动容器是 fixed 的 host（不是 window），按 56px 顶部留白手动对齐
  const scrollToHeading = (heading: HTMLElement): void => {
    const top = host.scrollTop + heading.getBoundingClientRect().top - 56
    host.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }

  tocNav.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest('a')
    if (!link) return
    event.preventDefault()
    const id = link.dataset.target
    const heading = id ? headingById.get(id) : null
    if (!heading) return
    scrollToHeading(heading)
    try {
      history.replaceState(null, '', `#${id}`)
    } catch {
      /* file:// 等场景可能禁止修改 history */
    }
  })

  const syncActive = (): void => {
    const top = 96
    let activeIndex = 0
    headings.forEach((heading, index) => {
      const rect = heading.getBoundingClientRect()
      if (rect.height > 0 && rect.top <= top) activeIndex = index
    })
    // 滚到底时末尾标题已无法到达顶部，否则点了最后一项却高亮上一项
    if (host.scrollTop + host.clientHeight >= host.scrollHeight - 4) {
      activeIndex = headings.length - 1
    }
    tocLinks.forEach((link, index) =>
      link.classList.toggle('is-active', index === activeIndex),
    )
  }
  let ticking = false
  host.addEventListener(
    'scroll',
    () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        syncActive()
      })
    },
    { passive: true },
  )

  renderArticle(docSource)
  requestAnimationFrame(() => requestAnimationFrame(syncActive))

  // ---- Mermaid ----
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
      host.scrollTo({
        top: host.scrollTop + rect.top - window.innerHeight / 2,
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
        // HTML 预览里交给浏览器原生查找，才能搜到 iframe 内的文字
        if (previewUrl) return
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
  // 直接打开 file:///a.png 这类非 Markdown 文件：预览就是页面本体，没有可返回的正文
  const standalone = initial !== undefined
  let showFiles = settings.showFiles
  let current = settings
  let rawMode = false
  let previewUrl: URL | null = null
  let previewKind: FileKind | null = null
  let previewLoading: Promise<string | null> | null = null
  let previewSeq = 0
  let imageZoom = 1
  let imagePanX = 0
  let imagePanY = 0

  function iconFor(entry: DirEntry): string {
    if (entry.type === 'dir') return ICONS.folder
    switch (entry.kind) {
      case 'html':
        return ICONS.html
      case 'image':
        return ICONS.image
      case 'pdf':
        return ICONS.pdf
      case 'media':
        return /\.(?:mp3|wav|ogg|oga|m4a|aac|flac)$/i.test(entry.name)
          ? ICONS.audio
          : ICONS.media
      case 'text':
        return ICONS.text
      case 'md':
        return ICONS.md
      default:
        return ICONS.file
    }
  }

  /** 当前项高亮：预览 / 原地切换时跟随目标文件，而不是地址栏 */
  function markCurrent(): void {
    const here = normalizePath(previewUrl?.href ?? docUrl.href)
    for (const node of tree.querySelectorAll<HTMLElement>('.mr-node[data-type="file"]')) {
      const link = node.querySelector<HTMLAnchorElement>(':scope > .mr-node-row .mr-node-name')
      if (!link) continue
      const isCurrent = normalizePath(link.href) === here
      node.classList.toggle('is-current', isCurrent)
      if (isCurrent) link.setAttribute('aria-current', 'page')
      else link.removeAttribute('aria-current')
    }
  }

  /** 读 HTML 源码，供预览态的「源码」视图使用 */
  async function loadPreviewSource(target: URL): Promise<void> {
    if (!previewLoading) {
      previewLoading = (async () => {
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'mr:readText',
            url: target.href,
          })
          return response?.ok ? String(response.text ?? '') : null
        } catch {
          return null
        }
      })()
    }
    const text = await previewLoading
    // 期间又切了别的文件：丢弃这次结果，避免污染正文区
    if (previewUrl?.href !== target.href) return
    sourceView.textContent = text ?? '无法读取源码，可点「新标签打开」查看'
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  function formatDuration(seconds: number): string {
    const total = Math.round(seconds)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  function updateImageMeta(): void {
    if (previewKind !== 'image' || !previewImage.naturalWidth) {
      previewMeta.textContent = ''
      return
    }
    previewMeta.textContent = `${previewImage.naturalWidth}×${previewImage.naturalHeight} · ${Math.round(imageZoom * 100)}%`
  }

  function applyImageTransform(): void {
    previewImage.style.transform = `translate(${imagePanX}px, ${imagePanY}px) scale(${imageZoom})`
    previewImageWrap.classList.toggle('is-zoomed', imageZoom > 1)
    updateImageMeta()
  }

  function resetImageZoom(): void {
    imageZoom = 1
    imagePanX = 0
    imagePanY = 0
    applyImageTransform()
  }

  previewImage.addEventListener('load', updateImageMeta)
  previewImage.addEventListener('error', () => {
    previewMeta.textContent = ''
  })

  // 图片：滚轮缩放、拖动平移、双击复位
  previewImageWrap.addEventListener(
    'wheel',
    (event) => {
      if (previewKind !== 'image') return
      event.preventDefault()
      const next = Math.min(8, Math.max(0.25, imageZoom * Math.exp(-event.deltaY * 0.0015)))
      if (Math.abs(next - imageZoom) < 0.001) return
      imageZoom = next
      if (imageZoom <= 1) {
        imagePanX = 0
        imagePanY = 0
      }
      applyImageTransform()
    },
    { passive: false },
  )

  let imageDrag: { x: number; y: number; panX: number; panY: number } | null = null
  previewImageWrap.addEventListener('pointerdown', (event) => {
    if (previewKind !== 'image' || imageZoom <= 1) return
    imageDrag = { x: event.clientX, y: event.clientY, panX: imagePanX, panY: imagePanY }
    previewImageWrap.setPointerCapture(event.pointerId)
    previewImageWrap.classList.add('is-dragging')
  })
  previewImageWrap.addEventListener('pointermove', (event) => {
    if (!imageDrag) return
    imagePanX = imageDrag.panX + (event.clientX - imageDrag.x)
    imagePanY = imageDrag.panY + (event.clientY - imageDrag.y)
    applyImageTransform()
  })
  const endImageDrag = (): void => {
    imageDrag = null
    previewImageWrap.classList.remove('is-dragging')
  }
  previewImageWrap.addEventListener('pointerup', endImageDrag)
  previewImageWrap.addEventListener('pointercancel', endImageDrag)
  previewImageWrap.addEventListener('dblclick', () => {
    if (previewKind === 'image') resetImageZoom()
  })

  /** 文本预览：纯文本 / 代码 / JSON / CSV 等统一只读展示，JSON 顺手美化 */
  function showPlainText(raw: string, name: string): void {
    let text = raw
    if (/\.jsonc?$|\.json5$/i.test(name)) {
      try {
        text = JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        /* 非标准 JSON 就按原文展示 */
      }
    }
    previewText.textContent = text
    previewMeta.textContent = `${text.split('\n').length} 行 · ${formatBytes(new Blob([text]).size)}`
  }

  async function loadPreviewText(target: URL, name: string): Promise<void> {
    const seq = ++previewSeq
    let text: string | null = null
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'mr:readText',
        url: target.href,
      })
      text = response?.ok ? String(response.text ?? '') : null
    } catch {
      text = null
    }
    // 期间又切了别的文件：丢弃这次结果
    if (seq !== previewSeq || previewKind !== 'text') return
    if (text === null) {
      previewText.textContent = '无法读取文件内容，可点「新标签打开」查看'
      previewMeta.textContent = ''
      return
    }
    showPlainText(text, name)
  }

  function renderMedia(entry: DirEntry): void {
    const isVideo = /\.(?:mp4|m4v|webm|ogv|mov)$/i.test(entry.name)
    const media = document.createElement(isVideo ? 'video' : 'audio')
    media.controls = true
    media.preload = 'metadata'
    media.src = entry.url
    media.className = 'mr-media'
    if (isVideo) media.setAttribute('playsinline', '')
    media.addEventListener(
      'loadedmetadata',
      () => {
        if (previewKind === 'media' && Number.isFinite(media.duration)) {
          previewMeta.textContent = formatDuration(media.duration)
        }
      },
      { once: true },
    )
    previewMedia.append(media)
  }

  function resetStage(): void {
    previewSeq++
    previewFrame.src = 'about:blank'
    previewFrame.setAttribute('sandbox', HTML_SANDBOX_BASE)
    previewImage.removeAttribute('src')
    previewImage.style.transform = ''
    previewText.textContent = ''
    previewText.classList.remove('is-wrap')
    previewMedia.replaceChildren()
    previewWrap.hidden = true
    previewWrap.setAttribute('aria-pressed', 'false')
    previewMeta.textContent = ''
    resetImageZoom()
  }

  function openPreview(entry: DirEntry): void {
    const kind: FileKind =
      entry.kind ?? (HTML_EXT.test(entry.name) ? 'html' : 'md')
    const url = new URL(entry.url)
    previewUrl = url
    previewKind = kind
    previewLoading = null
    rawMode = false
    rawButton.setAttribute('aria-pressed', 'false')
    resetStage()

    previewName.textContent = entry.name
    previewName.title = entry.url
    previewOpen.href = entry.url
    sourceView.textContent = '读取中…'

    previewFrame.hidden = kind !== 'html' && kind !== 'pdf'
    previewImageWrap.hidden = kind !== 'image'
    previewText.hidden = kind !== 'text'
    previewMedia.hidden = kind !== 'media'
    previewWrap.hidden = kind !== 'text'

    switch (kind) {
      case 'html':
      case 'pdf':
        if (kind === 'html') previewFrame.setAttribute('sandbox', htmlSandbox(entry.url))
        // PDF 交给浏览器内置阅读器，沙箱会挡掉它的插件通道
        else previewFrame.removeAttribute('sandbox')
        previewFrame.src = entry.url
        if (kind === 'html') void loadPreviewSource(url)
        break
      case 'image':
        previewImage.alt = entry.name
        previewImage.src = entry.url
        break
      case 'media':
        renderMedia(entry)
        break
      case 'text':
        previewText.textContent = '读取中…'
        void loadPreviewText(url, entry.name)
        break
      default:
        break
    }

    markCurrent()
    apply(current)
    host.scrollTop = 0
  }

  function closePreview(): void {
    previewUrl = null
    previewKind = null
    previewLoading = null
    resetStage()
    previewFrame.hidden = false
    previewImageWrap.hidden = true
    previewText.hidden = true
    previewMedia.hidden = true
    sourceView.textContent = docSource
    rawMode = false
    rawButton.setAttribute('aria-pressed', 'false')
    markCurrent()
    apply(current)
  }

  previewClose.addEventListener('click', closePreview)

  previewWrap.addEventListener('click', () => {
    const wrapped = !previewText.classList.contains('is-wrap')
    previewText.classList.toggle('is-wrap', wrapped)
    previewWrap.setAttribute('aria-pressed', String(wrapped))
  })

  let markdownSeq = 0

  /** 文件树里点 Markdown：读完原文就在本页换正文，不整页刷新 */
  async function openMarkdown(entry: DirEntry): Promise<void> {
    const seq = ++markdownSeq
    let text: string | null = null
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'mr:readText',
        url: entry.url,
      })
      text = response?.ok ? String(response.text ?? '') : null
    } catch {
      text = null
    }
    if (seq !== markdownSeq) return
    // 读不到就退回浏览器直接打开，至少还能看
    if (text === null) {
      window.open(entry.url, '_blank', 'noopener')
      return
    }

    // 先把上一篇的阅读位置落盘，再换正文
    if (!previewUrl) flushScroll()

    docSource = text
    docUrl = new URL(entry.url)
    previewUrl = null
    previewKind = null
    previewLoading = null
    resetStage()
    toolbarDoc.textContent = entry.name
    toolbarDoc.title = entry.name
    // 源码视图始终对应当前这篇
    sourceView.textContent = text
    renderArticle(text)
    closeFind()
    markCurrent()
    apply(current)
    host.scrollTop = 0
    restoreScroll(docUrl.href)

    try {
      // 地址栏跟着换，刷新后停在同一篇；file:// 下可能被拒，忽略即可
      history.replaceState(null, '', entry.url)
    } catch {
      /* 忽略 */
    }
  }

  async function requestDirectory(url: string): Promise<DirEntry[]> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'mr:listDir',
        url,
        includeOther: current.showOtherFiles,
      })
      return response?.ok ? (response.entries as DirEntry[]) : []
    } catch {
      return []
    }
  }

  function renderNodes(container: HTMLElement, entries: DirEntry[], depth: number): void {
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
        caret.innerHTML = ICONS.chevronRight
        caret.setAttribute('aria-label', '展开')
        row.append(caret)
      } else {
        const spacer = document.createElement('span')
        spacer.className = 'mr-caret-spacer'
        row.append(spacer)
      }

      const icon = document.createElement('span')
      icon.className = 'mr-icon'
      icon.innerHTML = iconFor(entry)
      if (entry.kind && entry.kind !== 'md') icon.dataset.kind = entry.kind
      row.append(icon)

      const name = document.createElement(entry.type === 'dir' ? 'span' : 'a')
      name.className = 'mr-node-name'
      name.textContent = entry.name
      if (entry.type === 'file') {
        ;(name as HTMLAnchorElement).href = entry.url
        name.addEventListener('click', (event) => {
          const mouse = event as MouseEvent
          // 修饰键 / 中键留给浏览器默认行为（新标签页打开）
          if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.button !== 0) return
          // Markdown 与其它类型一样原地切换，都不到整页刷新
          event.preventDefault()
          if ((entry.kind ?? 'md') === 'md') void openMarkdown(entry)
          else openPreview(entry)
        })
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
    markCurrent()
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
    const previewing = previewUrl !== null
    root.classList.toggle('is-preview', previewing)

    // 正文 / 源码 / iframe 预览三者互斥
    article.hidden = previewing || rawMode
    preview.hidden = !previewing || rawMode
    sourceView.hidden = !rawMode
    toc.hidden = previewing || rawMode || !settings.showToc || headings.length < 2
    // 预览态保留侧栏（方便继续切换文件），但源码视图沿用原有「专注模式」
    sidebar.hidden = !hasTree || !showFiles || (rawMode && !previewing)
    filesButton.setAttribute('aria-pressed', String(hasTree && showFiles))
    filesButton.title = hasTree && showFiles ? '收起文件目录' : '展开文件目录'
    filesButton.setAttribute('aria-label', filesButton.title)
    const tocButton = toolbar.querySelector<HTMLButtonElement>('[data-act="toc"]')!
    tocButton.setAttribute('aria-pressed', String(settings.showToc))
    tocButton.title = settings.showToc ? '收起目录' : '展开目录'
    tocButton.setAttribute('aria-label', tocButton.title)
    railLeft.hidden = !hasTree || !sidebar.hidden || (rawMode && !previewing)
    railRight.hidden = previewing || !toc.hidden || headings.length < 2 || rawMode
    tocButton.disabled = previewing
    const rawTitle = !previewing
      ? '查看 Markdown 源码'
      : previewKind === 'html'
        ? '查看 HTML 源码'
        : '该类型不支持源码视图'
    rawButton.disabled = previewing && previewKind !== 'html'
    rawButton.title = rawTitle
    rawButton.setAttribute('aria-label', rawTitle)
    if (themeChanged) refreshMermaid()
  }
  apply(settings)

  // 窄屏下抽屉默认是开着的（沿用 showFiles=true），会盖住正文，先收起
  const narrowQuery = window.matchMedia('(max-width: 1000px)')
  if (narrowQuery.matches) setFilesOpen(false)
  narrowQuery.addEventListener('change', (event) => {
    if (event.matches) setFilesOpen(false)
  })

  function toggleFiles(next: boolean): void {
    showFiles = next
    current = { ...current, showFiles: next }
    apply(current)
    void persist(current)
  }

  // 窄屏下文件树是抽屉，只改当前会话状态，不写回设置，免得影响宽屏的默认展开
  function setFilesOpen(next: boolean): void {
    showFiles = next
    current = { ...current, showFiles: next }
    apply(current)
  }

  function toggleToc(next: boolean): void {
    current = { ...current, showToc: next }
    apply(current)
    void persist(current)
  }

  // 折叠后贴边的展开手柄
  root.addEventListener('click', (event) => {
    const rail = (event.target as HTMLElement).closest<HTMLElement>('.mr-rail')
    if (!rail) return
    if (rail.classList.contains('mr-rail-left')) toggleFiles(true)
    else toggleToc(true)
  })

  // ---- 工具栏交互 ----
  toolbar.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('button')
    if (!button) return
    const act = button.dataset.act

    switch (act) {
      case 'files':
        toggleFiles(!showFiles)
        break
      case 'toc':
        toggleToc(!current.showToc)
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
        if (button.disabled) break
        rawMode = !rawMode
        button.setAttribute('aria-pressed', String(rawMode))
        apply(current)
        host.scrollTop = 0
        break
    }
  })

  sidebar.querySelector('.mr-sidebar-close')!.addEventListener('click', () => toggleFiles(false))
  scrim.addEventListener('click', () => setFilesOpen(false))
  toc.querySelector('.mr-toc-close')!.addEventListener('click', () => toggleToc(false))

  // ---- 悬停显示被截断的文件名 / 目录名 ----
  let tipTarget: HTMLElement | null = null
  function hideTip(): void {
    tip.hidden = true
    tipTarget = null
  }
  function showTip(target: HTMLElement): void {
    tip.textContent = target.textContent ?? ''
    tip.style.left = '0px'
    tip.style.top = '0px'
    tip.hidden = false
    const box = target.getBoundingClientRect()
    const size = tip.getBoundingClientRect()
    const gap = 6
    const left = Math.min(Math.max(8, box.left), window.innerWidth - size.width - 8)
    const below = box.bottom + gap
    const top =
      below + size.height <= window.innerHeight - 8
        ? below
        : box.top - size.height - gap
    tip.style.left = `${Math.round(left)}px`
    tip.style.top = `${Math.round(Math.max(8, top))}px`
  }
  root.addEventListener('pointerover', (event) => {
    const target =
      (event.target as Element | null)?.closest<HTMLElement>(
        '.mr-node-name, .mr-toc a',
      ) ?? null
    if (target === tipTarget) return
    // 没被截断就不弹：完整名字已经看得到
    if (!target || target.scrollWidth <= target.clientWidth + 1) {
      hideTip()
      return
    }
    tipTarget = target
    showTip(target)
  })
  root.addEventListener('pointerout', (event) => {
    const target =
      (event.target as Element | null)?.closest<HTMLElement>(
        '.mr-node-name, .mr-toc a',
      ) ?? null
    if (target && target === tipTarget) hideTip()
  })
  root.addEventListener('pointerdown', hideTip, true)
  host.addEventListener('scroll', hideTip, { passive: true })
  tocNav.addEventListener('scroll', hideTip, { passive: true })
  window.addEventListener('resize', hideTip)

  function persist(settings: Settings): Promise<void> {
    return chrome.storage.local.set({ settings }).catch(() => undefined)
  }

  // ---- 阅读位置记忆 ----
  let scrollSaveTimer = 0
  const flushScroll = (): void => {
    if (rawMode || previewUrl) return
    const top = Math.round(host.scrollTop)
    const key = pageKey(docUrl.href)
    void readScrollMap().then((map) => {
      map[key] = { top, at: Date.now() }
      return writeScrollMap(map)
    })
  }
  host.addEventListener(
    'scroll',
    () => {
      window.clearTimeout(scrollSaveTimer)
      scrollSaveTimer = window.setTimeout(flushScroll, 400)
    },
    { passive: true },
  )
  window.addEventListener('pagehide', () => {
    window.clearTimeout(scrollSaveTimer)
    flushScroll()
  })

  /** 恢复某篇文档上次的滚动位置 */
  function restoreScroll(href: string): void {
    void (async () => {
      const saved = (await readScrollMap())[pageKey(href)]?.top ?? 0
      if (!saved) return
      requestAnimationFrame(() => {
        const max = host.scrollHeight - host.clientHeight
        host.scrollTop = Math.min(saved, Math.max(0, max))
      })
    })()
  }

  // 带锚点进来时以锚点为准，不被记忆位置覆盖
  if (!location.hash.replace(/^#/, '').trim()) restoreScroll(docUrl.href)

  // 设置由 popup 改动时同步
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return
    const before = current
    current = { ...current, ...(changes.settings.newValue ?? {}) }
    // 「显示其他文件」变了要重拉目录，否则新类型不会出现
    if (before.showOtherFiles !== current.showOtherFiles) {
      void loadRoot(rootUrl)
    }
    apply(current)
  })

  // 跟随系统主题
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => apply(current))

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (!lightbox.hidden) {
      lightbox.hidden = true
      lightboxImg.src = ''
      return
    }
    // 窄屏抽屉开着时，Esc 先收起抽屉
    if (narrowQuery.matches && !sidebar.hidden) {
      setFilesOpen(false)
      return
    }
    // 查找框打开时 Esc 先关查找框（由它自己的监听器处理）
    if (!standalone && previewUrl && findBar.hidden) closePreview()
  })

  // ---- 接管页面 ----
  document.documentElement.style.overflow = 'hidden'
  document.body.replaceChildren(host)

  if (initial) {
    // 直接打开的非 Markdown 文件：进页面就展开预览，不经过文件树点击
    if (standalone) {
      previewClose.hidden = true
      previewClose.style.display = 'none'
      previewOpen.hidden = true
      previewOpen.style.display = 'none'
    }
    openPreview(initial)
    if (initial.kind === 'text' && typeof initialText === 'string') {
      // 页面里已经有源码，省一次后台读取（也绕过 readText 的 5MB 上限）
      previewSeq++
      showPlainText(initialText, initial.name)
    }
  }

  void loadRoot(new URL('.', location.href).href)

  window.addEventListener('pagehide', () => {
    document.documentElement.style.overflow = originalOverflow
  })
}

/**
 * 直接打开 file:// 的非 Markdown 文件（图片 / 音视频 / 纯文本）时接管页面，
 * 复用文件树里的预览面板；text 传入页面里已读到的源码，避免再向后台要一次。
 */
export function mountFile(
  kind: 'image' | 'media' | 'text',
  name: string,
  settings: Settings,
  text?: string,
): void {
  mount('', settings, { name, url: location.href, type: 'file', kind }, text)
}
