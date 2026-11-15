import { useEffect, useState } from 'react'
import { Plasma } from '@cruxgarden/plasma-ui'
import { QR_FORMATS } from '../../../shared/qr-formats'
import type { useImageConversion } from '../lib/use-image-conversion'

type Conversion = ReturnType<typeof useImageConversion>

export function ConversionPage({ busy, status, source, result, select, convert }: Conversion): React.JSX.Element {
  return (
    <div className="task-page conversion-task">
      <Plasma className="task-card import-card" fuse={false} lean={false}>
        <header className="task-card-heading">
          <div>
            <h1>二维码图层转换</h1>
            <p>在本机去掉白底，或保留黑块形状导出 SVG。</p>
          </div>
          <span className={'status-pill ' + status.kind}>{status.message}</span>
        </header>
        <div className="image-drop-zone">
          <div className="drop-wording">
            <strong>{source ? source.name : '把 PNG 拖到这里'}</strong>
            <span>支持纯黑白或黑块带全透明背景的 PNG</span>
          </div>
          <button type="button" className="primary-button" disabled={busy} onClick={() => void select()}>
            选择 PNG 图片
          </button>
        </div>
      </Plasma>
      <Plasma className="task-card" fuse={false} lean={false}>
        <header className="task-card-heading compact">
          <div><h2>转换方式</h2></div>
        </header>
        <div className="conversion-actions">
          <button type="button" className="secondary-button" disabled={busy || !source} onClick={() => void convert('remove-white')}>
            白底转透明 PNG
          </button>
          <button type="button" className="secondary-button" disabled={busy || !source} onClick={() => void convert('trace-transparent')}>
            透明 PNG 转 SVG
          </button>
          <button type="button" className="secondary-button" disabled={busy || !source} onClick={() => void convert('white-to-svg')}>
            白底直接转 SVG
          </button>
        </div>
        <p className="input-hint">
          {result?.format === 'transparent-png'
            ? '可直接将当前透明结果转为 SVG，然后另存。'
            : 'SVG 保留黑块位置和留白。使用时请放在浅色底面上。'}
        </p>
      </Plasma>
    </div>
  )
}

export function ConversionPreview({ source, result, savedPath, busy, save }: Conversion): React.JSX.Element {
  const [showOriginal, setShowOriginal] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setShowOriginal(false) }, [source?.sourceId, result?.resultId])
  const previewUrl = !showOriginal && result ? result.previewUrl : source?.previewUrl
  useEffect(() => { setFailed(false) }, [previewUrl])

  return (
    <Plasma as="aside" className="preview-dock" aria-label="转换预览" fuse={false} lean={false}>
      <header className="dock-header">
        <div><span className="section-kicker">预览</span><h2>转换预览</h2></div>
        <span className={'dock-state' + (result ? ' ready' : '')}>
          {result && !showOriginal ? QR_FORMATS[result.format].label : '原始图片'}
        </span>
      </header>
      {source && result && (
        <div className="preview-selector" role="group" aria-label="转换预览图片">
          <span className="preview-selector-thumb" style={{ '--preview-index': showOriginal ? 1 : 0 } as React.CSSProperties} aria-hidden="true" />
          <button type="button" className={showOriginal ? '' : 'active'} onClick={() => setShowOriginal(false)}>转换结果</button>
          <button type="button" className={showOriginal ? 'active' : ''} onClick={() => setShowOriginal(true)}>原始图片</button>
        </div>
      )}
      <div className={'preview-canvas' + (previewUrl && !failed ? ' has-image alpha-preview' : '')}>
        {previewUrl && !failed
          ? <img src={previewUrl} alt={result && !showOriginal ? '转换结果预览' : '待转换的原图'} onError={() => setFailed(true)} />
          : <div className="preview-empty"><strong>{failed ? '图片无法预览' : '等待选择 PNG'}</strong></div>}
      </div>
      <div className="preview-details">
        <span>{savedPath && !showOriginal ? '已保存到' : '原始路径'}</span>
        <code title={savedPath && !showOriginal ? savedPath : source?.path}>
          {(savedPath && !showOriginal ? savedPath : source?.path) || '尚未选择图片'}
        </code>
      </div>
      <div className="preview-actions">
        <button type="button" className="primary-button" disabled={busy || !result} onClick={() => void save()}>
          另存转换结果
        </button>
      </div>
    </Plasma>
  )
}
