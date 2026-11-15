import { QR_FORMATS } from '../../../shared/qr-formats'
import type { QrEngineId, QrExportFormat } from '../../../shared/types'

interface QrFormatSelectProps {
  engine: QrEngineId
  format: QrExportFormat
  disabled: boolean
  onChange: (format: QrExportFormat) => void
}

export function QrFormatSelect({
  engine,
  format,
  disabled,
  onChange
}: QrFormatSelectProps): React.JSX.Element {
  const local = engine === 'local'
  return (
    <div className="export-format">
      <label>
        <span>输出格式</span>
        <select
          value={local ? format : 'png'}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as QrExportFormat)}
        >
          {Object.entries(QR_FORMATS).map(([id, entry]) => (
            <option key={id} value={id} disabled={!local && id !== 'png'}>{entry.label}</option>
          ))}
        </select>
      </label>
      {!local && <span>透明 PNG 和 SVG 需先在设置中切换到本地处理。</span>}
    </div>
  )
}
