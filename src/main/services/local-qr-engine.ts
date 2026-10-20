import QRCode from 'qrcode'
import type { QrOptions } from '../../shared/types'
import { DEFAULT_ERROR_CORRECTION, DEFAULT_QR_BORDER, DEFAULT_QR_SIZE } from '../../shared/constants'
import { AppError } from './errors'
import { LocalDecodeEngine } from './local-decode-engine'
import type { EngineHealth, ImageBytes, QrCodeEngine } from './qr-code-engine'
import { validateQrOptions } from './qr-code-engine'

function capacityError(): AppError {
  return new AppError(
    'CONTENT_TOO_LONG',
    '内容超过当前纠错级别的二维码容量，请缩短文本或手动选择较低纠错级别。中文和表情会占用更多容量。'
  )
}

export class LocalQrEngine implements QrCodeEngine {
  readonly id = 'local' as const
  readonly supportsDecode = true

  async encode(content: string, options: QrOptions): Promise<Buffer> {
    if (typeof content !== 'string' || !content.trim()) {
      throw new AppError('EMPTY_CONTENT', '二维码内容不能为空')
    }
    const qr = validateQrOptions(options)
    // Even the largest numeric QR code holds at most 7089 characters.
    if (content.length > 7089) throw capacityError()
    try {
      const matrix = QRCode.create(content, { errorCorrectionLevel: qr.errorCorrection })
      const minimumSize = matrix.modules.size + qr.border * 2
      if (qr.size < minimumSize) {
        throw new AppError(
          'QR_SIZE_TOO_SMALL',
          `当前内容和边框至少需要 ${minimumSize}×${minimumSize} 像素，请增大二维码尺寸`
        )
      }
      // qrcode floors its scaled width; compensate only when roundoff would lose a pixel.
      const width = Math.floor(minimumSize * (qr.size / minimumSize)) < qr.size
        ? qr.size + Number.EPSILON * qr.size
        : qr.size
      return await QRCode.toBuffer(content, {
        type: 'png',
        width,
        margin: qr.border,
        errorCorrectionLevel: qr.errorCorrection,
        color: { dark: '#000000ff', light: '#ffffffff' }
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      const detail = error instanceof Error ? error.message : String(error)
      if (/too big|too large|amount of data|cannot contain|big enough/i.test(detail)) {
        throw capacityError()
      }
      throw new AppError('LOCAL_ENCODE_FAILED', `本地二维码生成失败：${detail}`)
    }
  }

  async decode(image: ImageBytes): Promise<string[]> {
    return new LocalDecodeEngine().decode(image)
  }

  async health(): Promise<EngineHealth> {
    const checkedAt = new Date().toISOString()
    try {
      await this.encode('EzQR-Tools', {
        size: DEFAULT_QR_SIZE,
        errorCorrection: DEFAULT_ERROR_CORRECTION,
        border: DEFAULT_QR_BORDER
      })
      return { ok: true, message: '本地生成引擎就绪，可离线使用', checkedAt }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '本地生成引擎不可用',
        checkedAt
      }
    }
  }
}
