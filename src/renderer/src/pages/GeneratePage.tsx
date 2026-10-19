import { Plasma } from '@cruxgarden/plasma-ui'
import { UI_TEXT_LIMIT } from '../../../shared/constants'
import type { QrSettings } from '../../../shared/types'
import type { UiStatus } from '../types'

interface GeneratePageProps {
  qrEngine: QrSettings['engine']
  content: string
  busy: boolean
  status: UiStatus
  fileMessage: string
  fileWarning: boolean
  onContentChange: (content: string) => void
  onGenerate: () => void
  onImportText: () => void
  onCopy: (text: string) => void
}

export function GeneratePage({
  qrEngine,
  content,
  busy,
  status,
  fileMessage,
  fileWarning,
  onContentChange,
  onGenerate,
  onImportText,
  onCopy
}: GeneratePageProps): React.JSX.Element {
  const characterCount = content.length

  return (
    <div className="task-page text-task">
      <Plasma className="task-card text-card" fuse={false} lean={false}>
        <header className="task-card-heading">
          <div>
            <span className="section-kicker">内容输入</span>
            <h1>输入文本或链接</h1>
            <p>
              {qrEngine === 'local'
                ? '本地离线生成，支持多行文字、网址和本地文档。'
                : '草料在线生成，输入内容会上传到草料接口。'}
            </p>
          </div>
          <span className="character-count">
            {characterCount} 字符
          </span>
        </header>

        <textarea
          className="content-input"
          value={content}
          spellCheck={false}
          maxLength={UI_TEXT_LIMIT}
          placeholder={'在这里输入二维码内容，例如：\nhttps://example.com\n你好，这是一张二维码'}
          onChange={(event) => onContentChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault()
              if (!busy && content.trim()) onGenerate()
            }
          }}
        />

        <div className="input-toolbar">
          <div className="toolbar-actions">
            <button
              type="button"
              className="primary-button"
              disabled={busy || !content.trim()}
              onClick={onGenerate}
            >
              {busy ? '正在生成…' : '生成二维码'}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={onImportText}
            >
              从文本文件读取
            </button>
            <button
              type="button"
              className="text-button"
              disabled={!content}
              onClick={() => onCopy(content)}
            >
              复制输入
            </button>
          </div>
          <span className={`status-text ${status.kind}`}>{status.message}</span>
        </div>

        {fileMessage && (
          <p className={fileWarning ? 'input-hint warning' : 'input-hint'}>
            {fileMessage}
          </p>
        )}
      </Plasma>

      <div className="quick-tips">
        <div>
          <span className="tip-number">01</span>
          <strong>快捷生成</strong>
          <p>输入内容后按 Ctrl + Enter，可直接生成二维码。</p>
        </div>
        <div>
          <span className="tip-number">02</span>
          <strong>本地读取</strong>
          <p>支持 TXT、Markdown、Word、ODT、JSON 等常用文本格式。</p>
        </div>
        <div>
          <span className="tip-number">03</span>
          <strong>容量与预览</strong>
          <p>容量受文本和纠错级别影响；生成后可在右侧预览并下载 PNG。</p>
        </div>
      </div>
    </div>
  )
}

