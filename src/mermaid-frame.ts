import { renderDiagram } from './mermaid'

type RenderRequest = {
  type: 'mr-mermaid-render'
  id: string
  code: string
  theme: 'light' | 'dark'
}

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as RenderRequest | undefined
  if (!data || data.type !== 'mr-mermaid-render') return

  const reply = (payload: Record<string, unknown>) => {
    ;(event.source as WindowProxy | null)?.postMessage(
      { type: 'mr-mermaid-result', id: data.id, ...payload },
      '*',
    )
  }

  renderDiagram(data.code, data.theme).then(
    (svg) => reply({ svg }),
    (error: unknown) => reply({ error: error instanceof Error ? error.message : String(error) }),
  )
})
