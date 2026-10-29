import { getSettings } from './shared/settings'
import { mount } from './renderer/ui'

const MD_EXT = /\.(?:md|markdown|mkd|mdx)$/i

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

async function main(): Promise<void> {
  if (document.getElementById('markdown-reader-host')) return
  if (!isMarkdownDocument() || !looksLikeRawText()) return

  const source = extractSource()
  if (!source) return

  const settings = await getSettings()
  mount(source, settings)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void main(), { once: true })
} else {
  void main()
}
