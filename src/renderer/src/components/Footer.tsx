import { useEffect, useState } from 'react'
import { Plasma } from '@cruxgarden/plasma-ui'
import type { ApiStatus } from '../../../shared/types'
import { formatClock } from '../../../shared/format'
import { GlassButton } from './GlassControls'

interface FooterProps {
  appVersion: string
  authorEmail: string
  apiStatus: ApiStatus
  apiBusy: boolean
  onRecheck: () => void
  onCopyEmail: () => void
}

export function Footer({
  appVersion,
  authorEmail,
  apiStatus,
  apiBusy,
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
        <span
          className={`status-dot ${
            apiStatus.ok === true ? 'ok' : apiStatus.ok === false ? 'error' : 'busy'
          }`}
        />
        <span className="footer-api-text" title={apiStatus.message}>
          {apiStatus.message}
        </span>
        <GlassButton
          size="sm"
          disabled={apiBusy}
          onClick={onRecheck}
          className="footer-retry"
        >
          {apiBusy ? '检测中…' : '重新检测'}
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

