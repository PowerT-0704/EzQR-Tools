import { expect, type Locator } from '@playwright/test'
import jsQR from 'jsqr'
import type { PNG } from 'pngjs'

export function expectTransparentQr(png: PNG, content: string): void {
  const opaque = Uint8ClampedArray.from(png.data)
  let background = 0
  let foreground = 0
  for (let offset = 0; offset < opaque.length; offset += 4) {
    if (opaque[offset + 3] === 0) {
      background += 1
      opaque.fill(255, offset, offset + 4)
    } else if (opaque[offset + 3] === 255 && opaque[offset] === 0 &&
      opaque[offset + 1] === 0 && opaque[offset + 2] === 0) {
      foreground += 1
    } else {
      throw new Error('Expected only opaque black or fully transparent pixels')
    }
  }
  expect(background).toBeGreaterThan(0)
  expect(foreground).toBeGreaterThan(0)
  expect(jsQR(opaque, png.width, png.height)?.data).toBe(content)
}

export async function readSvgPreview(preview: Locator, content: string) {
  const raster = await preview.evaluate(async (element) => {
    const image = element as HTMLImageElement
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Expected a Canvas 2D context')
    const response = await fetch(image.currentSrc)
    const svg = await response.blob()
    const url = URL.createObjectURL(svg)
    try {
      const vector = new Image()
      vector.src = url
      await vector.decode()
      context.drawImage(vector, 0, 0)
    } finally {
      URL.revokeObjectURL(url)
    }
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const alpha = Array.from(pixels.filter((_byte, index) => index % 4 === 3))
    context.globalCompositeOperation = 'destination-over'
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return {
      width: canvas.width,
      height: canvas.height,
      opaque: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data),
      alpha,
      mime: response.headers.get('content-type'),
      text: await svg.text()
    }
  })
  expect(raster.mime).toContain('image/svg+xml')
  expect(raster.text).toMatch(/<path fill="#000"/)
  expect(raster.text).not.toMatch(/<(image|script|foreignObject)\b/)
  expect(raster.alpha).toContain(0)
  expect(raster.alpha).toContain(255)
  expect(jsQR(Uint8ClampedArray.from(raster.opaque), raster.width, raster.height)?.data).toBe(content)
  return raster
}
