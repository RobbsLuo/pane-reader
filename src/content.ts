import { getSettings } from './shared/settings'
import { mount, mountFile } from './renderer/ui'

const MD_EXT = /\.(?:md|markdown|mkd|mdx)$/i
const HTML_EXT = /\.(?:html?|xhtml)$/i
/** 浏览器会当纯文本渲染的 application/* MIME */
const TEXTUAL_APP =
  /^application\/(?:json|ld\+json|json5|xml|yaml|x-yaml|toml|javascript|ecmascript|x-httpd-php|graphql|graphql-response\+json|sql)$/i
const BOOTING_CLASS = 'mr-booting'
const PREFLIGHT_ID = 'markdown-reader-preflight'

type DirectKind = 'image' | 'media' | 'text'

/** 被阅读器当作 iframe 嵌入的页面（如 HTML 预览）不接管，否则会无限嵌套 */
function isFramed(): boolean {
  try {
    return window.top !== window.self
  } catch {
    return true
  }
}

function isMarkdownUrl(): boolean {
  try {
    return MD_EXT.test(new URL(location.href).pathname)
  } catch {
    return false
  }
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

function fileName(): string {
  const last = pathnameOf(location.href).split('/').filter(Boolean).pop()
  if (!last) return '文件'
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

function isTextualMime(type: string): boolean {
  if (!type) return false
  if (type.startsWith('text/')) return !type.startsWith('text/markdown')
  return TEXTUAL_APP.test(type)
}

/**
 * 浏览器直接打开 file:///a.png 时，它自己渲染成 <img> / <video> / <pre>。
 * 这里按 MIME 判断能否改成阅读器预览；PDF 交给浏览器内置阅读器（扩展读不到插件内容），
 * HTML 保持原生渲染，不接管。
 */
function directKindFromMime(): DirectKind | null {
  if (location.protocol !== 'file:') return null
  if (isMarkdownDocument()) return null
  if (HTML_EXT.test(pathnameOf(location.href))) return null

  const type = (document.contentType || '').toLowerCase()
  if (type === 'application/pdf' || type === 'application/xhtml+xml') return null
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/') || type.startsWith('audio/')) return 'media'
  if (isTextualMime(type)) return 'text'
  return null
}

/** MIME 不可靠时（少数本地文本文件），再看 DOM 结构兜底 */
function directKind(): DirectKind | null {
  const byMime = directKindFromMime()
  if (byMime) return byMime
  if (location.protocol !== 'file:') return null
  if (isMarkdownDocument() || HTML_EXT.test(pathnameOf(location.href))) return null
  const type = (document.contentType || '').toLowerCase()
  if (type === 'application/pdf' || type.startsWith('image/') || type.startsWith('video/')) {
    return null
  }
  return looksLikeRawText() ? 'text' : null
}

/** 浏览器是否把它当作可读文本展示（而不是 HTML 应用页） */
function looksLikeRawText(): boolean {
  const body = document.body
  if (!body) return false
  const pre = body.querySelector(':scope > pre')
  if (pre && body.children.length === 1) return true
  const type = (document.contentType || '').toLowerCase()
  return type === 'text/plain' || type.startsWith('text/markdown')
}

function isMarkdownDocument(): boolean {
  const type = (document.contentType || '').toLowerCase()
  return type.startsWith('text/markdown') || isMarkdownUrl()
}

function extractSource(): string | null {
  const body = document.body
  if (!body) return null

  // Chrome 打开纯文本 / .md 文件时的结构：<body><pre>…</pre></body>
  const pre = body.querySelector(':scope > pre')
  if (pre && body.children.length === 1) {
    return pre.textContent || null
  }

  // 少数情况下浏览器直接以纯文本注入 body
  if (looksLikeRawText()) {
    const text = body.innerText
    return text.trim() ? text : null
  }

  return null
}

/** 前一个页面跳转时写进 hash 的主题，用于首帧就铺对背景色 */
function bootTheme(): 'light' | 'dark' {
  const match = /[#&]mr-theme=(light|dark)/.exec(location.hash)
  if (match) return match[1] as 'light' | 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * document_start 阶段立刻执行：先把背景铺成阅读色并隐藏原始 Markdown 文本，
 * 渲染完成后再 reveal()，避免「裸文本一闪 → 重排」的闪动。
 */
function preflight(): void {
  if (isFramed() || document.getElementById(PREFLIGHT_ID)) return
  // 直接打开的图片 / 音视频 / 纯文本同样先遮住浏览器原生视图
  if (!isMarkdownUrl() && directKindFromMime() === null) return

  const theme = bootTheme()
  const background = theme === 'dark' ? '#0e1116' : '#ffffff'

  const style = document.createElement('style')
  style.id = PREFLIGHT_ID
  style.textContent = [
    `html{background:${background};}`,
    `html.${BOOTING_CLASS}{overflow:hidden;}`,
    `html.${BOOTING_CLASS} body{opacity:0 !important;}`,
  ].join('')
  ;(document.head ?? document.documentElement).append(style)
  document.documentElement.classList.add(BOOTING_CLASS)

  // 兜底：脚本异常 / 长时间未渲染时不能让页面永远空白
  window.setTimeout(reveal, 1500)
}

/** 渲染完成（或超时）后恢复显示 */
function reveal(): void {
  document.documentElement.classList.remove(BOOTING_CLASS)
  document.getElementById(PREFLIGHT_ID)?.remove()
}

/** 清掉导航用的 #mr-theme，避免污染地址栏和页内锚点 */
function stripThemeHash(): void {
  if (!location.hash.includes('mr-theme=')) return
  const rest = location.hash
    .replace(/^#/, '')
    .split('&')
    .filter((part) => part && !part.startsWith('mr-theme='))
    .join('&')
  try {
    history.replaceState(null, '', `${location.pathname}${location.search}${rest ? `#${rest}` : ''}`)
  } catch {
    /* file:// 等场景可能禁止修改 history */
  }
}

async function main(): Promise<void> {
  // iframe 里的页面（HTML 预览）交还给浏览器原生渲染
  if (isFramed()) return
  if (document.getElementById('markdown-reader-host')) {
    reveal()
    return
  }
  // 直接打开本地图片 / 音视频 / 纯文本：改成阅读器预览，而不是浏览器原生视图
  const direct = directKind()
  if (direct) {
    const text = direct === 'text' ? (extractSource() ?? undefined) : undefined
    try {
      const settings = await getSettings()
      mountFile(direct, fileName(), settings, text)
      stripThemeHash()
    } finally {
      reveal()
    }
    return
  }

  if (!isMarkdownDocument() || !looksLikeRawText()) {
    reveal()
    return
  }

  const source = extractSource()
  if (!source) {
    reveal()
    return
  }

  try {
    const settings = await getSettings()
    mount(source, settings)
    stripThemeHash()
  } finally {
    reveal()
  }
}

// document_start 就要抢在浏览器绘制原始文本之前
preflight()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void main(), { once: true })
} else {
  void main()
}
