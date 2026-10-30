export type FileKind = 'md' | 'html' | 'image' | 'media' | 'pdf' | 'text'

export interface DirEntry {
  name: string
  url: string
  type: 'file' | 'dir'
  kind?: FileKind
}

const MD_EXT = /\.(?:md|markdown|mkd|mdx)$/i
const HTML_EXT = /\.(?:html?|xhtml)$/i
const IMAGE_EXT = /\.(?:png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i
const MEDIA_EXT = /\.(?:mp4|m4v|webm|ogv|mov|mp3|wav|ogg|oga|m4a|aac|flac)$/i
const PDF_EXT = /\.pdf$/i
const TEXT_EXT =
  /\.(?:txt|log|json|jsonc|json5|ya?ml|toml|ini|cfg|conf|properties|csv|tsv|xml|srt|vtt|diff|patch|sql|graphql|gql|proto|env)$/i
const CODE_EXT =
  /\.(?:js|mjs|cjs|jsx|ts|tsx|css|scss|sass|less|html?|vue|svelte|astro|sh|bash|zsh|fish|py|rb|go|rs|java|kt|kts|c|h|cc|cpp|cxx|hpp|cs|php|swift|dart|lua|pl|r|scala|ex|exs|hs|clj|zig|nim)$/i

/** 文件扩展名 → 预览类型；Markdown 与 HTML 始终列出，其余按设置决定 */
function classify(name: string): FileKind | null {
  if (MD_EXT.test(name)) return 'md'
  if (HTML_EXT.test(name)) return 'html'
  if (IMAGE_EXT.test(name)) return 'image'
  if (PDF_EXT.test(name)) return 'pdf'
  if (MEDIA_EXT.test(name)) return 'media'
  if (TEXT_EXT.test(name) || CODE_EXT.test(name)) return 'text'
  return null
}

/** 目录树里的排序：目录 → Markdown → HTML → 图片 → PDF → 文本 → 音视频 */
const KIND_ORDER: Record<FileKind, number> = {
  md: 0,
  html: 1,
  image: 2,
  pdf: 3,
  text: 4,
  media: 5,
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

interface RawLink {
  href: string
  name?: string
  isDir?: boolean
}

/** 标准目录索引：<a href="...">（nginx / Apache autoindex 等） */
function parseAnchors(html: string): RawLink[] {
  const links: RawLink[] = []
  const re = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  for (const match of html.matchAll(re)) {
    const href = decodeEntities(match[1]).trim()
    const name = decodeEntities(match[2].replace(/<[^>]*>/g, '')).trim()
    if (href) links.push({ href, name })
  }
  return links
}

/** Chrome 本地目录列表：<script>addRow("name","url",isdir,size,...)</script> */
function parseAddRows(html: string): RawLink[] {
  const links: RawLink[] = []
  const re = /addRow\("((?:[^"\\]|\\.)*)","((?:[^"\\]|\\.)*)",([01])/g
  for (const match of html.matchAll(re)) {
    links.push({
      href: match[2].replace(/\\"/g, '"'),
      name: match[1].replace(/\\"/g, '"'),
      isDir: match[3] === '1',
    })
  }
  return links
}

/**
 * 解析目录索引页，只返回直接子项：目录在前，Markdown 文件在后。
 * file:// 下 fetch 的 response.status 是 0，不能用 response.ok 判断。
 */
async function listDirectory(dirUrl: string, includeOther = false): Promise<DirEntry[]> {
  const base = new URL(dirUrl)
  if (!base.pathname.endsWith('/')) base.pathname += '/'

  const response = await fetch(base.href, { credentials: 'omit', cache: 'no-store' })
  if (response.status >= 400) return []

  let html = ''
  try {
    html = await response.text()
  } catch {
    return []
  }
  if (!html) return []

  const links = [...parseAnchors(html), ...parseAddRows(html)]
  const entries: DirEntry[] = []
  const seen = new Set<string>()

  for (const link of links) {
    const href = link.href
    if (!href || href.startsWith('?') || href.startsWith('#') || href.startsWith('/')) {
      continue
    }
    if (href === '..' || href.startsWith('../')) continue

    let target: URL
    try {
      target = new URL(href, base)
    } catch {
      continue
    }

    if (target.origin !== base.origin) continue
    if (!target.pathname.startsWith(base.pathname)) continue
    if (target.pathname === base.pathname) continue

    const relative = target.pathname.slice(base.pathname.length)
    const trimmed = relative.replace(/\/$/, '')

    // 只展示直接子项，深层等展开时再请求
    if (!trimmed || trimmed.includes('/')) continue

    const isDir = link.isDir ?? target.pathname.endsWith('/')

    let name = link.name?.replace(/\/$/, '') ?? ''
    if (!name) {
      try {
        name = decodeURIComponent(trimmed)
      } catch {
        name = trimmed
      }
    }
    if (!name || name === '..') continue
    const kind = isDir ? undefined : classify(name)
    if (!isDir && !kind) continue
    // 默认只列 Markdown / HTML；图片、PDF、文本等由设置开启
    if (kind && kind !== 'md' && kind !== 'html' && !includeOther) continue

    const key = target.pathname
    if (seen.has(key)) continue
    seen.add(key)

    entries.push({
      name,
      url: target.href,
      type: isDir ? 'dir' : 'file',
      kind: isDir ? undefined : (kind ?? undefined),
    })
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    const rank = (KIND_ORDER[a.kind ?? 'md'] ?? 0) - (KIND_ORDER[b.kind ?? 'md'] ?? 0)
    if (rank !== 0) return rank
    return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true })
  })

  return entries.slice(0, 500)
}

/** 读取文本源码，供 HTML 预览的「源码」视图使用 */
const MAX_TEXT_BYTES = 5 * 1024 * 1024

async function readText(url: string): Promise<string> {
  const response = await fetch(url, { credentials: 'omit', cache: 'no-store' })
  if (response.status >= 400) throw new Error(`HTTP ${response.status}`)
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > MAX_TEXT_BYTES) throw new Error('文件过大')
  const text = await response.text()
  return text.length > MAX_TEXT_BYTES ? text.slice(0, MAX_TEXT_BYTES) : text
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'mr:listDir') {
    listDirectory(String(message.url), Boolean(message.includeOther))
      .then((entries) => sendResponse({ ok: true, entries }))
      .catch((error: unknown) =>
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      )
    return true
  }

  if (message?.type === 'mr:readText') {
    readText(String(message.url))
      .then((text) => sendResponse({ ok: true, text }))
      .catch((error: unknown) =>
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      )
    return true
  }

  return undefined
})
