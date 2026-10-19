import { useEffect, useState } from 'react'
import { Plasma } from '@cruxgarden/plasma-ui'
import type { ApiStatus, QrSettings } from '../../../shared/types'
import { formatClock } from '../../../shared/format'
import { GlassButton } from './GlassControls'

interface FooterProps {
  appVersion: string
  authorEmail: string
  apiStatus: ApiStatus
  apiBusy: boolean
  qrEngine: QrSettings['engine']
  onRecheck: () => void
  onCopyEmail: () => void
}

export function Footer({
  appVersion,
  authorEmail,
  apiStatus,
  apiBusy,
  qrEngine,
  onRecheck,
  onCopyEmail
}: FooterProps): React.JSX.Element {
  const [clock, setClock] = useState(formatClock())

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatClock()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <Plasma
      as="footer"
      className="footerbar"
      fuse={false}
      lean={false}
      radius={17}
      elevation={0.3}
    >
      <div className="footer-api">
        <span className="footer-engine">
          <span className={`status-dot ${qrEngine === 'local' ? 'ok' : ''}`} />
          {qrEngine === 'local' ? '本地生成 · 可离线' : '草料在线生成'}
        </span>
        <span className="footer-online-label">在线接口</span>
        <span
          className={`status-dot ${
            apiStatus.ok === true ? 'ok' : apiStatus.ok === false ? 'error' : apiBusy ? 'busy' : ''
          }`}
        />
        <span className="footer-api-text" title={apiStatus.message}>
          {apiBusy
            ? '检测中…'
            : apiStatus.ok === null
              ? '未检测'
              : apiStatus.message.replace(/^(接口状态|在线接口)[：:]\s*/, '')}
        </span>
        <GlassButton
          size="sm"
          disabled={apiBusy}
          onClick={onRecheck}
          className="footer-retry"
        >
          {apiBusy ? '检测中…' : '检测接口'}
        </GlassButton>
      </div>
      <div className="footer-meta">
        <button type="button" className="link-button" onClick={onCopyEmail}>
          {authorEmail}
        </button>
        <span>·</span>
        <span>当前时间：{clock}</span>
        <span>·</span>
        <span>版本 v{appVersion}</span>
      </div>
    </Plasma>
  )
}

