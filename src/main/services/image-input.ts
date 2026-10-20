import { stat } from 'node:fs/promises'
import { MAX_NORMALIZED_PNG_BYTES, MAX_QR_SOURCE_BYTES } from '../../shared/constants'
import { validateImageDimensions } from '../../shared/image-limits'
import { AppError } from './errors'

export async function validateQrSource(filePath: string): Promise<void> {
  const file = await stat(filePath)
  if (!file.isFile()) throw new AppError('IMAGE_READ', '请选择有效的图片文件')
  if (file.size > MAX_QR_SOURCE_BYTES) {
    throw new AppError('IMAGE_TOO_LARGE', '二维码源图片最多 32 MiB，请裁剪或缩小后重试')
  }
}

export function validateNormalizedPng(bytes: unknown): asserts bytes is Uint8Array {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 33) {
    throw new AppError('INVALID_IMAGE', '图片转换数据无效或已损坏，请重新选择图片')
  }
  if (bytes.byteLength > MAX_NORMALIZED_PNG_BYTES) {
    throw new AppError('IMAGE_TOO_LARGE', '转换后的 PNG 最多 64 MiB，请裁剪或缩小后重试')
  }
  const png = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      png.readUInt32BE(8) !== 13 || png.toString('ascii', 12, 16) !== 'IHDR') {
    throw new AppError('INVALID_IMAGE', '图片转换数据不是有效的 PNG，请重新选择图片')
  }
  try {
    validateImageDimensions(png.readUInt32BE(16), png.readUInt32BE(20))
  } catch (error) {
    throw new AppError('INVALID_IMAGE', error instanceof Error ? error.message : '图片尺寸无效')
  }
}
