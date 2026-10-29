import mermaid from 'mermaid'

/**
 * 渲染 Mermaid 图表为 SVG 字符串。
 * 独立打包成 mermaid.js，content script 在遇到 mermaid 代码块时按需 import。
 */
export async function renderDiagram(code: string, theme: 'light' | 'dark'): Promise<string> {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'default',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    flowchart: { useMaxWidth: true },
    sequence: { useMaxWidth: true },
  })

  const id = `mr-mermaid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const { svg } = await mermaid.render(id, code)
  return svg
}
