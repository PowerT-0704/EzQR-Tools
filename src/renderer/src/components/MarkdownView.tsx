import type { ReactNode } from 'react'

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>
    }
    return <span key={`${keyPrefix}-${index}`}>{part}</span>
  })
}

export function MarkdownView({ content }: { content: string }): React.JSX.Element {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  const bullets: string[] = []

  const flushBullets = (): void => {
    if (!bullets.length) return
    const items = bullets.splice(0)
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{inline(item, `bullet-${blocks.length}-${index}`)}</li>
        ))}
      </ul>
    )
  }

  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (!line) {
      flushBullets()
      return
    }
    if (/^(-{3,}|—{3,})$/.test(line)) {
      flushBullets()
      blocks.push(<hr key={`hr-${index}`} />)
      return
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      bullets.push(line.slice(2))
      return
    }
    flushBullets()
    if (line.startsWith('### ')) {
      blocks.push(<h3 key={`h3-${index}`}>{inline(line.slice(4), `h3-${index}`)}</h3>)
    } else if (line.startsWith('## ')) {
      blocks.push(<h2 key={`h2-${index}`}>{inline(line.slice(3), `h2-${index}`)}</h2>)
    } else if (line.startsWith('# ')) {
      blocks.push(<h1 key={`h1-${index}`}>{inline(line.slice(2), `h1-${index}`)}</h1>)
    } else {
      blocks.push(<p key={`p-${index}`}>{inline(line, `p-${index}`)}</p>)
    }
  })
  flushBullets()

  return <div className="markdown">{blocks}</div>
}

