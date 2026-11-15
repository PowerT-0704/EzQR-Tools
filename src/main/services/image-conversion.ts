import { nativeImage } from 'electron'
import type { ConversionMode, ConversionResult } from '../../shared/types'
import { AppError } from './errors'
import { validateNormalizedPng } from './image-input'
import { renderBlackSvg } from './qr-svg'

export function convertPng(
  bytes: Buffer,
  mode: ConversionMode
): { bytes: Buffer; format: ConversionResult['format'] } {
  validateNormalizedPng(bytes)
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  const image = nativeImage.createFromBuffer(bytes)
  const size = image.getSize()
  if (image.isEmpty() || size.width !== width || size.height !== height) {
    throw new AppError('INVALID_IMAGE', 'PNG 无法读取，文件可能已损坏，请重新选择')
  }
  const pixels = image.toBitmap()
  if (pixels.length !== width * height * 4) {
    throw new AppError('INVALID_IMAGE', '无法读取 PNG 的像素数据')
  }
  const transparentSource = mode === 'trace-transparent'
  let hasBlack = false
  let hasBackground = false
  for (let offset = 0; offset < pixels.length; offset += 4) {
    // Windows nativeImage stores BGRA. Channel order does not affect black or white.
    const alpha = pixels[offset + 3]
    const black = alpha === 255 && pixels[offset] === 0 && pixels[offset + 1] === 0 && pixels[offset + 2] === 0
    const background = transparentSource
      ? alpha === 0
      : alpha === 255 && pixels[offset] === 255 && pixels[offset + 1] === 255 && pixels[offset + 2] === 255
    if (!black && !background) {
      throw new AppError('INVALID_IMAGE', transparentSource
        ? '请选择只有纯黑像素和全透明背景的 PNG，或先使用「白底转透明 PNG」'
        : '请选择纯黑白、完全不透明的 PNG。带灰边、彩色或半透明的图片可尝试在图片重构中处理')
    }
    if (black) hasBlack = true
    if (background) {
      hasBackground = true
      pixels.writeUInt32LE(0, offset)
    }
  }
  if (!hasBlack || !hasBackground) {
    throw new AppError('INVALID_IMAGE', transparentSource
      ? '图片必须同时包含黑块和透明背景'
      : '图片必须同时包含黑块和不透明白底')
  }
  if (mode !== 'remove-white') {
    return {
      bytes: renderBlackSvg(width, height, (x, y) => pixels[(y * width + x) * 4 + 3] === 255),
      format: 'svg'
    }
  }
  const png = nativeImage.createFromBitmap(pixels, { width, height }).toPNG()
  if (!png.length) throw new AppError('LOCAL_ENCODE_FAILED', '透明 PNG 生成失败，请重试')
  return { bytes: png, format: 'transparent-png' }
}
