import mermaid from 'mermaid'

/**
 * 与页面令牌同色系的图表变量。
 * 不用 mermaid 自带的 dark 主题：它在深底上仍是紫色节点，几乎看不清。
 */
const LIGHT_VARS = {
  background: '#ffffff',
  primaryColor: '#f3f5f8',
  primaryTextColor: '#1a1d21',
  primaryBorderColor: '#c4cad3',
  secondaryColor: '#eceff3',
  tertiaryColor: '#fafbfc',
  mainBkg: '#f3f5f8',
  nodeBorder: '#c4cad3',
  lineColor: '#8b93a0',
  textColor: '#1a1d21',
  titleColor: '#1a1d21',
  clusterBkg: '#fafbfc',
  clusterBorder: '#e4e7ec',
  edgeLabelBackground: '#ffffff',
  noteBkgColor: '#f7f8fa',
  noteTextColor: '#1a1d21',
  noteBorderColor: '#e4e7ec',
  fontSize: '14px',
}

const DARK_VARS = {
  background: '#0e1116',
  primaryColor: '#1d2530',
  primaryTextColor: '#e6e9ee',
  primaryBorderColor: '#46505c',
  secondaryColor: '#232932',
  tertiaryColor: '#14181e',
  mainBkg: '#1d2530',
  nodeBorder: '#46505c',
  lineColor: '#8d97a3',
  textColor: '#e6e9ee',
  titleColor: '#e6e9ee',
  clusterBkg: '#13171c',
  clusterBorder: '#2a303a',
  edgeLabelBackground: '#0e1116',
  noteBkgColor: '#15191f',
  noteTextColor: '#e6e9ee',
  noteBorderColor: '#2a303a',
  fontSize: '14px',
}

/**
 * 渲染 Mermaid 图表为 SVG 字符串。
 * 独立打包成 mermaid.js，content script 在遇到 mermaid 代码块时按需 import。
 */
export async function renderDiagram(code: string, theme: 'light' | 'dark'): Promise<string> {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: theme === 'dark' ? DARK_VARS : LIGHT_VARS,
    fontFamily:
      'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    flowchart: { useMaxWidth: true, curve: 'basis', padding: 14 },
    sequence: { useMaxWidth: true, mirrorActors: false, messageAlign: 'center' },
    gantt: { useMaxWidth: true },
    pie: { useMaxWidth: true },
  })

  const id = `mr-mermaid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const { svg } = await mermaid.render(id, code)
  return svg
}
