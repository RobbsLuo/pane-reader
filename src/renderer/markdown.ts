import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import { katex } from '@mdit/plugin-katex'
import hljs from 'highlight.js/lib/core'

import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import bash from 'highlight.js/lib/languages/bash'
import python from 'highlight.js/lib/languages/python'
import yaml from 'highlight.js/lib/languages/yaml'
import markdownLang from 'highlight.js/lib/languages/markdown'
import sql from 'highlight.js/lib/languages/sql'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import java from 'highlight.js/lib/languages/java'
import csharp from 'highlight.js/lib/languages/csharp'
import cpp from 'highlight.js/lib/languages/cpp'
import diff from 'highlight.js/lib/languages/diff'
import ini from 'highlight.js/lib/languages/ini'
import dockerfile from 'highlight.js/lib/languages/dockerfile'

for (const [name, lang] of Object.entries({
  javascript, typescript, json, xml, css, bash, python, yaml, markdownLang,
  sql, go, rust, java, csharp, cpp, diff, ini, dockerfile,
})) {
  hljs.registerLanguage(name, lang)
}
hljs.registerAliases(['js', 'jsx', 'mjs', 'cjs'], { languageName: 'javascript' })
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' })
hljs.registerAliases(['html', 'svg', 'vue'], { languageName: 'xml' })
hljs.registerAliases(['sh', 'shell', 'zsh', 'console'], { languageName: 'bash' })
hljs.registerAliases(['yml'], { languageName: 'yaml' })
hljs.registerAliases(['md'], { languageName: 'markdown' })
hljs.registerAliases(['py'], { languageName: 'python' })
hljs.registerAliases(['c#', 'cs'], { languageName: 'csharp' })
hljs.registerAliases(['c++', 'cc'], { languageName: 'cpp' })

/** 生成稳定、去重友好的标题 id（保留中文） */
function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
  return slug || 'section'
}

function resolveUrl(url: string): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return url
  try {
    return new URL(url, document.baseURI).href
  } catch {
    return url
  }
}

export function createMarkdown() {
  const md = new MarkdownIt({
    html: false, // 默认禁止内嵌 HTML，防 XSS
    linkify: true,
    typographer: true,
    breaks: false,
  })

  // 允许 data:image 等合法资源，javascript: 链接由 DOMPurify 清洗
  md.validateLink = () => true

  md.use(anchor, {
    slugify,
    level: [1, 2, 3, 4],
  })
  md.use(footnote)
  md.use(taskLists, { enabled: false, label: false })
  md.use(katex, { throwOnError: false, strict: false })

  // 代码高亮延迟到进入视口再做：长文档里 90% 的高亮开销都在屏幕外
  md.options.highlight = (code, lang) => {
    const language = lang?.trim().toLowerCase() ?? ''
    const escaped = md.utils.escapeHtml(code)
    if (!language) return `<pre class="hljs"><code>${escaped}</code></pre>`
    return `<pre class="hljs" data-lang="${md.utils.escapeHtml(
      language,
    )}"><code class="language-${md.utils.escapeHtml(language)}">${escaped}</code></pre>`
  }

  // Mermaid：输出占位块，正文渲染完成后再按需绘制
  const defaultFence = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    if (token.info.trim().toLowerCase() === 'mermaid') {
      return `<div class="mr-mermaid" data-code="${md.utils.escapeHtml(
        encodeURIComponent(token.content),
      )}"></div>`
    }
    return defaultFence
      ? defaultFence(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options)
  }

  // 图片：解析相对路径 + 懒加载
  const defaultImage = md.renderer.rules.image!
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const src = token.attrGet('src')
    if (typeof src === 'string') token.attrSet('src', resolveUrl(src))
    token.attrSet('loading', 'lazy')
    token.attrSet('decoding', 'async')
    return defaultImage(tokens, idx, options, env, self)
  }

  // 链接：外链新窗口打开
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet('href')
    const hrefValue = typeof href === 'string' ? href : null
    if (hrefValue) tokens[idx].attrSet('href', resolveUrl(hrefValue))
    if (hrefValue && !hrefValue.startsWith('#')) {
      tokens[idx].attrSet('target', '_blank')
      tokens[idx].attrSet('rel', 'noopener noreferrer')
    }
    return defaultLinkOpen(tokens, idx, options, env, self)
  }

  return md
}

export const markdown = createMarkdown()

/** 对已插入 DOM 的代码块做高亮，供视口懒加载调用 */
export function highlightCode(code: string, lang: string | undefined): string {
  const language = lang?.trim().toLowerCase()
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value
    } catch {
      /* fallthrough */
    }
  }
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderMarkdown(source: string): string {
  return markdown.render(source)
}
