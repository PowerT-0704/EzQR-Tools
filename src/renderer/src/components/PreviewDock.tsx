import { useEffect, useState } from 'react'
import { Plasma } from '@cruxgarden/plasma-ui'
import type { GenerateResult, MediaSelection, RebuildResult, WorkspaceId } from '../../../shared/types'

interface PreviewDockProps {
  decodeSelection: MediaSelection | null
  workspace: WorkspaceId
  rebuildResult: RebuildResult | null
  generateResult: GenerateResult | null
  lastSavedPath: string
  onOpenImage: (path: string) => void
  onOpenFolder: (kind: 'rebuilt' | 'generated') => void
  onSave: () => void
}

export function PreviewDock({
  decodeSelection,
  workspace,
  rebuildResult,
  generateResult,
  lastSavedPath,
  onOpenImage,
  onOpenFolder,
  onSave
}: PreviewDockProps): React.JSX.Element {
  const [imageView, setImageView] = useState<'rebuilt' | 'source'>('rebuilt')
  const [sourceFailed, setSourceFailed] = useState(false)

  useEffect(() => setSourceFailed(false), [decodeSelection?.previewUrl])

  useEffect(() => {
    setImageView('rebuilt')
  }, [rebuildResult])

  if (workspace === 'decode') {
    return (
      <Plasma as="aside" className="preview-dock" aria-label="原图预览" fuse={false} lean={false}>
        <header className="dock-header">
          <div><span className="section-kicker">预览</span><h2>原图预览</h2></div>
          <span className="dock-state">仅解析</span>
        </header>
        <div className={`preview-canvas ${decodeSelection && !sourceFailed ? 'has-image' : ''}`}>
          {decodeSelection && !sourceFailed ? (
            <img src={decodeSelection.previewUrl} alt="待解析的二维码原图" onError={() => setSourceFailed(true)} />
          ) : (
            <div className="preview-empty"><span className="preview-empty-mark" aria-hidden="true">码</span>
              <strong>{sourceFailed ? '原图无法预览' : '等待导入图片'}</strong>
              <p>此处仅显示原始图片，不生成新的二维码。</p>
            </div>
          )}
        </div>
        <div className="preview-details"><span>原始路径</span><code title={decodeSelection?.path}>{decodeSelection?.path || '尚未选择图片'}</code></div>
        <div className="preview-actions"><span className="preview-action-hint">解析内容显示在结果栏，不保存图片或历史。</span></div>
      </Plasma>
    )
  }

  const hasRebuild = workspace === 'rebuild' && rebuildResult !== null
  const hasGenerate = workspace === 'generate' && generateResult !== null
  const previewUrl = hasRebuild
    ? imageView === 'source'
      ? rebuildResult.sourcePreviewUrl
      : rebuildResult.rebuiltPreviewUrl
    : hasGenerate
      ? generateResult.previewUrl
      : ''

  return (
    <Plasma
      as="aside"
      className="preview-dock"
      aria-label="二维码预览"
      fuse={false}
      lean={false}
    >
      <header className="dock-header">
        <div>
          <span className="section-kicker">预览</span>
          <h2>二维码预览</h2>
        </div>
        <span className={`dock-state ${previewUrl ? 'ready' : ''}`}>
          {previewUrl ? '已就绪' : '等待生成'}
        </span>
      </header>

      {hasRebuild && (
        <div className="preview-selector" role="group" aria-label="预览图片">
          <span
            className="preview-selector-thumb"
            style={{ '--preview-index': imageView === 'rebuilt' ? 0 : 1 } as React.CSSProperties}
            aria-hidden="true"
          />
          <button
            type="button"
            className={imageView === 'rebuilt' ? 'active' : ''}
            onClick={() => setImageView('rebuilt')}
          >
            重构结果
          </button>
          <button
            type="button"
            className={imageView === 'source' ? 'active' : ''}
            onClick={() => setImageView('source')}
          >
            原始图片
          </button>
        </div>
      )}

      <div className={`preview-canvas ${previewUrl ? 'has-image' : ''}`}>
        {previewUrl ? (
          <img src={previewUrl} alt={hasRebuild ? '二维码重构预览' : '生成的二维码'} />
        ) : (
          <div className="preview-empty">
            <span className="preview-empty-mark" aria-hidden="true">
              码
            </span>
            <strong>
              {workspace === 'rebuild' ? '等待导入图片' : '等待生成二维码'}
            </strong>
            <p>
              {workspace === 'rebuild'
                ? '解析成功后，重构结果会显示在这里。'
                : '输入文本并生成后，可在这里预览和下载。'}
            </p>
          </div>
        )}
      </div>

      <div className="preview-details">
        {hasRebuild ? (
          <>
            <span>{imageView === 'rebuilt' ? '已保存到' : '原始路径'}</span>
            <code title={imageView === 'rebuilt' ? rebuildResult.savedPath : rebuildResult.sourcePath}>
              {imageView === 'rebuilt' ? rebuildResult.savedPath : rebuildResult.sourcePath}
            </code>
          </>
        ) : hasGenerate ? (
          <>
            <span>{lastSavedPath ? '最近保存' : '生成信息'}</span>
            <code title={lastSavedPath || generateResult.info}>
              {lastSavedPath || generateResult.info}
            </code>
          </>
        ) : (
          <>
            <span>状态</span>
            <code>尚未生成二维码</code>
          </>
        )}
      </div>

      <div className="preview-actions">
        {hasRebuild ? (
          <>
            <button
              type="button"
              className="primary-button"
              onClick={() => onOpenImage(rebuildResult.savedPath)}
            >
              打开重构图片
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onOpenFolder('rebuilt')}
            >
              打开输出文件夹
            </button>
          </>
        ) : hasGenerate ? (
          <>
            <button type="button" className="primary-button" onClick={onSave}>
              下载二维码
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!lastSavedPath}
              onClick={() => onOpenFolder('generated')}
            >
              打开输出文件夹
            </button>
          </>
        ) : (
          <span className="preview-action-hint">完成操作后，相关按钮会显示在这里。</span>
        )}
      </div>
    </Plasma>
  )
}

