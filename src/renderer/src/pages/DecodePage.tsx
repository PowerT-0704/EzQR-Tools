import { Plasma } from '@cruxgarden/plasma-ui'
import type { DecodeResult } from '../../../shared/types'
import type { UiStatus } from '../types'

interface DecodePageProps {
  busy: boolean
  status: UiStatus
  result: DecodeResult | null
  onChoose: () => void
  onRetry?: () => void
  onCopy: (text: string) => void
}

export function DecodePage({ busy, status, result, onChoose, onRetry, onCopy }: DecodePageProps): React.JSX.Element {
  return (
    <div className="task-page image-task decode-task" aria-busy={busy}>
      <Plasma className="task-card import-card" fuse={false} lean={false}>
        <header className="task-card-heading">
          <div>
            <span className="section-kicker">本地解析</span>
            <h1>解析二维码图片</h1>
            <p>只读取图片中的二维码内容，不重构、不保存新图片，也不写入历史记录。</p>
          </div>
          <span className={`status-pill ${status.kind}`}>{status.message}</span>
        </header>
        <div className={`image-drop-zone ${busy ? 'busy' : ''}`}>
          <div className="drop-icon" aria-hidden="true"><span /><span /><span /><span /><i /></div>
          <div className="drop-wording">
            <strong>{busy ? '正在本地解析…' : '把图片拖到这里'}</strong>
            <span>PNG、JPG、JPEG、BMP、GIF、WebP · 动画读取首帧</span>
          </div>
          <button type="button" className="primary-button" disabled={busy} onClick={onChoose}>
            {busy ? '正在解析…' : '选择二维码图片'}
          </button>
          {onRetry && !busy && <button type="button" className="secondary-button" onClick={onRetry}>重试此图片</button>}
        </div>
      </Plasma>
      <Plasma className="task-card decode-card" fuse={false} lean={false}>
        <header className="task-card-heading compact">
          <div>
            <span className="section-kicker">解析结果</span>
            <h2>{result ? `共识别 ${result.contents.length} 个二维码` : '二维码内容'}</h2>
          </div>
        </header>
        {busy ? (
          <div className="empty-task-state decode-loading" role="status">
            <span className="decode-loading-orbit" aria-hidden="true" />
            <strong>{status.message}</strong>
            <p>内容始终在本机处理，请稍候。</p>
          </div>
        ) : result ? (
          <div className="decode-results">
            {result.contents.map((content, index) => (
              <article className="decode-result-item" key={index} aria-label={`二维码 ${index + 1}`}>
                <div className="decode-result-heading">
                  <strong>二维码 {index + 1}{content.length === 0 ? ' · 空内容' : ''}</strong>
                  <button type="button" className="text-button" aria-label={`复制二维码 ${index + 1} 内容`} onClick={() => onCopy(content)}>复制内容</button>
                </div>
                <pre className="decode-output">{content}</pre>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-task-state">
            <span className="empty-task-orbit" aria-hidden="true" />
            <strong>{status.kind === 'error' ? '本次解析未完成' : '尚未解析图片'}</strong>
            <p>选择或拖入图片，识别到的全部内容将显示在这里，可逐条复制。</p>
          </div>
        )}
      </Plasma>
    </div>
  )
}
