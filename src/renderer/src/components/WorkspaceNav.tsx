import { Plasma } from '@cruxgarden/plasma-ui'
import type { WorkspaceId } from '../../../shared/types'

interface WorkspaceNavProps {
  value: WorkspaceId
  onChange: (value: WorkspaceId) => void
}

const ITEMS: Array<{
  id: WorkspaceId
  label: string
  description: string
  icon: React.JSX.Element
}> = [
  {
    id: 'rebuild',
    label: '图片重构',
    description: '解析并高清重建',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
        <rect x="8" y="8" width="8" height="8" rx="1.5" />
      </svg>
    )
  },
  {
    id: 'generate',
    label: '文本生成',
    description: '把文字变成二维码',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 7h14M5 12h10M5 17h7" />
        <circle cx="18" cy="17" r="2" />
      </svg>
    )
  }
]

export function WorkspaceNav({
  value,
  onChange
}: WorkspaceNavProps): React.JSX.Element {
  const activeIndex = Math.max(0, ITEMS.findIndex((item) => item.id === value))
  return (
    <Plasma
      as="nav"
      className="workspace-nav"
      aria-label="工作区导航"
      fuse={false}
      lean={false}
    >
      <span className="nav-caption">工作区</span>
      <div
        className="workspace-nav-track"
        role="tablist"
        aria-orientation="vertical"
        style={{ '--active-workspace': activeIndex } as React.CSSProperties}
      >
        <span className="workspace-nav-thumb" aria-hidden="true" />
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={value === item.id}
            className={value === item.id ? 'active' : ''}
            onClick={() => onChange(item.id)}
          >
            <span className="workspace-nav-icon">{item.icon}</span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="workspace-nav-note">
        <span className="nav-note-dot" />
        本地工具 · 数据保存在本机
      </div>
    </Plasma>
  )
}

