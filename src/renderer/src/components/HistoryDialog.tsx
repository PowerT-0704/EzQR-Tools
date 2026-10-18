import type { AppearanceSettings, HistoryRecord } from '../../../shared/types'
import { truncateMiddle } from '../../../shared/format'
import { ModalShell } from './ModalShell'

interface HistoryDialogProps {
  appearance: AppearanceSettings
  records: HistoryRecord[]
  onClose: () => void
  onReuse: (record: HistoryRecord) => void
  onOpenPath: (path: string) => void
  onClear: () => void
}

export function HistoryDialog({
  appearance,
  records,
  onClose,
  onReuse,
  onOpenPath,
  onClear
}: HistoryDialogProps): React.JSX.Element {
  return (
    <ModalShell
      appearance={appearance}
      title="历史记录"
      eyebrow="最近操作"
      onClose={onClose}
    >
      <div className="history-dialog-summary">
        <span>共 {records.length} 条记录，双击文本记录可直接回填。</span>
        <button type="button" className="text-button danger" disabled={!records.length} onClick={onClear}>
          清空记录
        </button>
      </div>

      <div className="modal-scroll history-dialog-list">
        {records.length ? (
          records.map((record) => (
            <article
              key={record.id}
              className="history-dialog-item"
              onDoubleClick={() => record.type === 'generate' && onReuse(record)}
            >
              <div className="history-item-top">
                <span className={`history-kind ${record.type}`}>
                  {record.type === 'generate' ? '生成' : '重构'}
                </span>
                <time>{record.time}</time>
              </div>
              <p title={record.content}>{record.content}</p>
              {record.savedPath && (
                <code title={record.savedPath}>{truncateMiddle(record.savedPath, 72)}</code>
              )}
              <div className="history-item-actions">
                {record.type === 'generate' && (
                  <button type="button" onClick={() => onReuse(record)}>
                    回填内容
                  </button>
                )}
                {record.savedPath && (
                  <button type="button" onClick={() => onOpenPath(record.savedPath)}>
                    打开文件
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="drawer-empty">
            <span aria-hidden="true">◎</span>
            <strong>还没有历史记录</strong>
            <p>完成一次图片重构或文本生成后，记录会显示在这里。</p>
          </div>
        )}
      </div>

      <footer className="modal-footer history-dialog-footer">
        <span>历史记录保存在本机配置目录</span>
        <button type="button" className="primary-button" onClick={onClose}>
          关闭
        </button>
      </footer>
    </ModalShell>
  )
}

