import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { prepareZXingModule, purgeZXingModule, readBarcodes, ZXING_WASM_SHA256 } from 'zxing-wasm/reader'
import { AppError } from './errors'
import { validateNormalizedPng } from './image-input'
import type { ImageBytes } from './qr-code-engine'

const decoderRequire = createRequire(import.meta.url)
let readerReady: Promise<void> | undefined

function loadReader(): Promise<void> {
  readerReady ??= (async () => {
    const wasmPath = decoderRequire.resolve('zxing-wasm/reader/zxing_reader.wasm')
    const bytes = await readFile(wasmPath)
    if (createHash('sha256').update(bytes).digest('hex') !== ZXING_WASM_SHA256) {
      throw new Error('WASM 文件校验失败')
    }
    await prepareZXingModule({
      overrides: {
        wasmBinary: Uint8Array.from(bytes).buffer,
        // Never allow the library's default CDN locator to become a fallback.
        locateFile: () => wasmPath
      },
      fireImmediately: true
    })
  })().catch(() => {
    purgeZXingModule()
    readerReady = undefined
    throw new AppError('LOCAL_DECODE_UNAVAILABLE', '本地解析组件加载失败，请重试；若持续失败，请重新安装应用。图片未上传。')
  })
  return readerReady
}

export class LocalDecodeEngine {
  async decode(image: ImageBytes): Promise<string[]> {
    validateNormalizedPng(image.bytes)
    await loadReader()
    try {
      const results = await readBarcodes(image.bytes, {
        formats: ['QRCode'],
        tryHarder: true,
        tryRotate: true,
        tryInvert: true,
        textMode: 'Plain'
      })
      const top = (result: (typeof results)[number]): number =>
        Math.min(...Object.values(result.position).map((point) => point.y))
      const left = (result: (typeof results)[number]): number =>
        Math.min(...Object.values(result.position).map((point) => point.x))
      return results.filter((result) => result.isValid)
        .sort((a, b) => top(a) - top(b) || left(a) - left(b))
        .map((result) => result.text)
    } catch {
      throw new AppError('LOCAL_DECODE_FAILED', '本地解析失败：图片可能已损坏，请重新选择或转换图片后重试。图片未上传。')
    }
  }
}
