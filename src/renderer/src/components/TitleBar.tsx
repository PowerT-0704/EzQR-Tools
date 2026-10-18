import { Plasma } from '@cruxgarden/plasma-ui'
import type { WindowState } from '../../../shared/types'
import { GlassButton } from './GlassControls'

interface TitleBarProps {
  maximized: boolean
  apiOk: boolean | null
  historyOpen: boolean
  historyCount: number
  updateAvailable: boolean
  onHistory: () => void
  onAnnouncement: () => void
  onSettings: () => void
  onWindowState: (state: WindowState) => void
}

export function TitleBar({
  maximized,
  apiOk,
  historyOpen,
  historyCount,
  updateAvailable,
  onHistory,
  onAnnouncement,
  onSettings,
  onWindowState
}: TitleBarProps): React.JSX.Element {
  return (
    <Plasma
      as="header"
      className="titlebar"
      fuse={false}
      lean={false}
      radius={22}
      elevation={0.1}
    >
      <div className="brand">
        <img className="brand-logo" src="./logo.png" alt="" draggable={false} />
        <div className="brand-copy">
          <strong>易码 EzQR-Tools</strong>
          <span>轻盈液态玻璃二维码工作台</span>
        </div>
        <span
          className={`header-status ${apiOk === true ? 'is-online' : apiOk === false ? 'is-offline' : 'is-checking'}`}
          title={
            apiOk === true
              ? '接口已连接'
              : apiOk === false
                ? '接口暂时不可用'
                : '接口检测中'
          }
        />
      </div>

      <div className="titlebar-actions no-drag">
        <GlassButton
          size="sm"
          className={`history-toggle ${historyOpen ? 'active' : ''}`}
          onClick={onHistory}
        >
          历史记录
          {historyCount > 0 && <span className="history-count">{historyCount}</span>}
        </GlassButton>
        <GlassButton size="sm" onClick={onAnnouncement}>
          开发公告
        </GlassButton>
        <GlassButton
          size="sm"
          className={`settings-toggle ${updateAvailable ? 'has-update' : ''}`}
          title={updateAvailable ? '发现新版本，请打开设置查看' : undefined}
          onClick={onSettings}
        >
          软件设置
          {updateAvailable && <span className="update-indicator" aria-hidden="true" />}
        </GlassButton>
        <span className="titlebar-divider" />
        <button
          className="window-button"
          type="button"
          aria-label="最小化"
          onClick={() => void window.qrTool.minimizeWindow()}
        >
          ─
        </button>
        <button
          className="window-button"
          type="button"
          aria-label={maximized ? '还原窗口' : '最大化'}
          onClick={async () => onWindowState(await window.qrTool.toggleMaximizeWindow())}
        >
          {maximized ? '❐' : '□'}
        </button>
        <button
          className="window-button close"
          type="button"
          aria-label="关闭"
          onClick={() => void window.qrTool.closeWindow()}
        >
          ✕
        </button>
      </div>
    </Plasma>
  )
}

