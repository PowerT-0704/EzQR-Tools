import { Plasma } from '@cruxgarden/plasma-ui'
import type { QrSettings, RebuildResult } from '../../../shared/types'
import { truncateContent, truncateMiddle } from '../../../shared/format'
import type { UiStatus } from '../types'

interface RebuildPageProps {
  qrEngine: QrSettings['engine']
  busy: boolean
  status: UiStatus
  result: RebuildResult | null
  onChoose: () => void
  onRetry?: () => void
  onOpenImage: (path: string) => void
  onCopy: (text: string) => void
}

export function RebuildPage({
  qrEngine,
  busy,
  status,
  result,
  onChoose,
  onRetry,
  onOpenImage,
  onCopy
}: RebuildPageProps): React.JSX.Element {
  return (
    <div className="task-page image-task">
      <Plasma className="task-card import-card" fuse={false} lean={false}>
        <header className="task-card-heading">
          <div>
            <span className="section-kicker">第一步</span>
            <h1>导入二维码图片</h1>
            <p>
              {qrEngine === 'local'
                ? '图片在本机解析并生成高清二维码，断网可用，无需 API Key。'
                : '图片上传草料在线解析，识别内容再上传草料生成二维码。'}
            </p>
          </div>
          <span className={`status-pill ${status.kind}`}>{status.message}</span>
        </header>

        <div className={`image-drop-zone ${busy ? 'busy' : ''}`}>
          <div className="drop-icon" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <i />
          </div>
          <div className="drop-wording">
            <strong>把图片拖到这里</strong>
            <span>支持 PNG、JPG、JPEG、BMP、GIF、WebP</span>
          </div>
          <button type="button" className="primary-button" disabled={busy} onClick={onChoose}>
            {busy ? '正在处理…' : '选择二维码图片'}
          </button>
          {onRetry && !busy && (
            <button type="button" className="secondary-button" onClick={onRetry}>重试此图片</button>
          )}
        </div>
      </Plasma>

      <Plasma className="task-card decode-card" fuse={false} lean={false}>
        <header className="task-card-heading compact">
          <div>
            <span className="section-kicker">解析结果</span>
            <h2>识别内容与保存位置</h2>
          </div>
          {result && (
            <button
              type="button"
              className="text-button"
              onClick={() => onCopy(result.content)}
            >
              复制内容
            </button>
          )}
        </header>

        {result ? (
          <div className="decode-content">
            <div className="detail-row">
              <span>原始图片</span>
              <button
                type="button"
                className="path-link"
                title={result.sourcePath}
                onClick={() => onOpenImage(result.sourcePath)}
              >
                {truncateMiddle(result.sourcePath, 84)}
              </button>
            </div>
            <div className="detail-row">
              <span>保存位置</span>
              <button
                type="button"
                className="path-link success"
                title={result.savedPath}
                onClick={() => onOpenImage(result.savedPath)}
              >
                {truncateMiddle(result.savedPath, 84)}
              </button>
            </div>
            <pre className="decode-output">{truncateContent(result.content)}</pre>
            <div className="task-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => onOpenImage(result.savedPath)}
              >
                打开重构图片
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={onChoose}
              >
                重新选择
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-task-state">
            <span className="empty-task-orbit" aria-hidden="true" />
            <strong>尚未解析图片</strong>
            <p>选择或拖入一张二维码图片后，识别内容和保存路径会显示在这里。</p>
          </div>
        )}
      </Plasma>
    </div>
  )
}

