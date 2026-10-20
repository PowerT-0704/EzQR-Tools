import { MAX_NORMALIZED_PNG_BYTES, MAX_QR_SOURCE_BYTES } from '../../../shared/constants'
import { validateImageDimensions } from '../../../shared/image-limits'

export async function normalizeQrImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('图片无法读取，文件可能已被移动，请重新选择图片')
  const blob = await response.blob()
  if (blob.size > MAX_QR_SOURCE_BYTES) {
    throw new Error('二维码源图片最多 32 MiB，请裁剪或缩小后重试')
  }
  let bitmap: ImageBitmap
  try {
    // Chromium decodes the first frame of animated images from a Blob.
    bitmap = await createImageBitmap(blob)
  } catch {
    throw new Error('图片无法读取，文件可能已损坏，请重新选择图片')
  }
  const canvas = document.createElement('canvas')
  try {
    validateImageDimensions(bitmap.width, bitmap.height)
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('图片转换失败，请重试')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('图片转换失败，请重试')), 'image/png')
    })
    if (png.size > MAX_NORMALIZED_PNG_BYTES) {
      throw new Error('转换后的 PNG 最多 64 MiB，请裁剪或缩小后重试')
    }
    return new Uint8Array(await png.arrayBuffer())
  } finally {
    bitmap.close()
    canvas.width = 0
    canvas.height = 0
  }
}

export function createOperationId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return '发生未预期的错误'
}

