import { getSettings } from './shared/settings'
import { mount } from './renderer/ui'

const MD_EXT = /\.(?:md|markdown|mkd|mdx)$/i
const BOOTING_CLASS = 'mr-booting'
const PREFLIGHT_ID = 'markdown-reader-preflight'

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
  if (isFramed() || !isMarkdownUrl() || document.getElementById(PREFLIGHT_ID)) return

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
