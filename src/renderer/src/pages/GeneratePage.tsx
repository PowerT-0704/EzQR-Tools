import { Plasma } from '@cruxgarden/plasma-ui'
import type { UiStatus } from '../types'

interface GeneratePageProps {
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
            <p>支持多行文字、网址和从本地文档读取内容。</p>
          </div>
          <span className={characterCount > 900 ? 'character-count warning' : 'character-count'}>
            {characterCount} 字符
          </span>
        </header>

        <textarea
          className="content-input"
          value={content}
          spellCheck={false}
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

        {(fileMessage || characterCount > 900) && (
          <p className={fileWarning || characterCount > 900 ? 'input-hint warning' : 'input-hint'}>
            {fileMessage ||
              '内容超过官方建议的 900 字符，仍可尝试生成，但服务器可能拒绝。'}
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
          <strong>右侧预览</strong>
          <p>生成结果会立即显示在右侧，并可下载为 PNG 图片。</p>
        </div>
      </div>
    </div>
  )
}

