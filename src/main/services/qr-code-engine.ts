import type { QrEngineId, QrOptions, QrSettings } from '../../shared/types'
import { AppError } from './errors'

export interface ImageBytes {
  bytes: Uint8Array
  name: string
}

export interface EngineHealth {
  ok: boolean
  message: string
  checkedAt: string
}

export interface QrCodeEngine {
  readonly id: QrEngineId
  readonly supportsDecode: boolean
  encode(content: string, options: QrOptions): Promise<Buffer>
  decode(image: ImageBytes): Promise<string[]>
  health(): Promise<EngineHealth>
}

export function validateQrOptions(raw: unknown): QrOptions {
  if (!raw || typeof raw !== 'object') {
    throw new AppError('INVALID_QR_OPTIONS', '二维码参数无效')
  }
  const options = raw as Record<string, unknown>
  if (
    typeof options.size !== 'number' ||
    !Number.isInteger(options.size) ||
    options.size < 128 ||
    options.size > 4096
  ) {
    throw new AppError('INVALID_QR_OPTIONS', '二维码尺寸必须是 128–4096 之间的整数')
  }
  if (
    typeof options.errorCorrection !== 'string' ||
    !['L', 'M', 'Q', 'H'].includes(options.errorCorrection)
  ) {
    throw new AppError('INVALID_QR_OPTIONS', '二维码纠错级别必须是 L / M / Q / H')
  }
  if (
    typeof options.border !== 'number' ||
    !Number.isInteger(options.border) ||
    options.border < 0 ||
    options.border > 16
  ) {
    throw new AppError('INVALID_QR_OPTIONS', '二维码边框必须是 0–16 之间的整数')
  }
  return {
    size: options.size,
    errorCorrection: options.errorCorrection as QrOptions['errorCorrection'],
    border: options.border
  }
}

export function validateQrSettings(raw: unknown): QrSettings {
  const options = validateQrOptions(raw)
  const engine = (raw as Record<string, unknown>).engine
  if (engine !== 'local' && engine !== 'caoliao') {
    throw new AppError('INVALID_QR_OPTIONS', '请选择本地处理或草料在线处理引擎')
  }
  return { ...options, engine }
}
