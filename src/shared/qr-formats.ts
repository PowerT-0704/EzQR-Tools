import type { QrExportFormat } from './types'

export const QR_FORMATS = {
  png: { label: '白底 PNG', extension: 'png', mime: 'image/png' },
  'transparent-png': { label: '透明 PNG', extension: 'png', mime: 'image/png' },
  svg: { label: 'SVG 矢量图', extension: 'svg', mime: 'image/svg+xml' }
} as const satisfies Record<QrExportFormat, { label: string; extension: string; mime: string }>
