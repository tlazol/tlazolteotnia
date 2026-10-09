import { useEffect, useId, useState } from 'react'

let mermaidPromise: Promise<typeof import('mermaid')['default']> | undefined

function loadMermaid() {
  mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      htmlLabels: false,
      theme: 'base',
      themeCSS: '.edgePaths .edge-thickness-normal { stroke-width: 2px; }',
      themeVariables: {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        primaryColor: '#202c33',
        primaryTextColor: '#f2f0f6',
        primaryBorderColor: '#88c5d0',
        lineColor: '#b5b9c5',
        secondaryColor: '#242133',
        tertiaryColor: '#191d24',
        edgeLabelBackground: '#101114'
      },
      flowchart: { look: 'classic', useMaxWidth: false, nodeSpacing: 24, rankSpacing: 32 }
    })

    return mermaid
  })

  return mermaidPromise
}

export function MermaidDiagram({ code }: { code: string }) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [result, setResult] = useState<{ code: string; src?: string; failed?: boolean }>()
  const title = /^\s*accTitle:\s*(.+)$/m.exec(code)?.[1] ?? 'フロー図'
  const description = /^\s*accDescr:\s*(.+)$/m.exec(code)?.[1] ?? title
  const current = result?.code === code ? result : undefined

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = await loadMermaid()
        if (cancelled) return
        const { svg } = await mermaid.render(id, code)
        if (!cancelled) {
          // Display as an image so SVG content cannot execute in the article's DOM.
          setResult({ code, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` })
        }
      } catch {
        if (!cancelled) setResult({ code, failed: true })
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [code, id])

  return (
    <figure className="mermaid-diagram">
      <figcaption>{title}</figcaption>
      {current?.src ? <img alt={description} src={current.src} /> : <p>{description}</p>}
      {current?.failed && (
        <details>
          <summary>図を表示できませんでした。元の記述を確認する</summary>
          <pre>
            <code>{code}</code>
          </pre>
        </details>
      )}
    </figure>
  )
}
