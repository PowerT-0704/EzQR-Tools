import { MAX_QR_IMAGE_PIXELS, MAX_QR_IMAGE_SIDE } from './constants'

export function validateImageDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('图片尺寸无效，文件可能已损坏，请重新选择图片')
  }
  if (width > MAX_QR_IMAGE_SIDE || height > MAX_QR_IMAGE_SIDE || width * height > MAX_QR_IMAGE_PIXELS) {
    throw new Error('图片过大：单边最多 8192 像素、总像素最多 16777216，请裁剪或缩小后重试')
  }
}
