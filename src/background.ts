export interface DirEntry {
  name: string
  url: string
  type: 'file' | 'dir'
}

const MD_EXT = /\.(?:md|markdown|mkd|mdx)$/i

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
async function listDirectory(dirUrl: string): Promise<DirEntry[]> {
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
    if (!isDir && !MD_EXT.test(name)) continue

    const key = target.pathname
    if (seen.has(key)) continue
    seen.add(key)

    entries.push({ name, url: target.href, type: isDir ? 'dir' : 'file' })
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true })
  })

  return entries.slice(0, 500)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'mr:listDir') return

  listDirectory(String(message.url))
    .then((entries) => sendResponse({ ok: true, entries }))
    .catch((error: unknown) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    )

  return true
})
