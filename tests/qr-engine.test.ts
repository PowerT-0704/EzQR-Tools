import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import jsQR, { type QRCode } from 'jsqr'
import { PNG } from 'pngjs'
import type { ErrorCorrection, QrOptions } from '../src/shared/types'
import { CaoliaoQrEngine } from '../src/main/services/caoliao-qr-engine'
import { LocalQrEngine } from '../src/main/services/local-qr-engine'
import { validateQrSettings } from '../src/main/services/qr-code-engine'

const defaults: QrOptions = { size: 1024, errorCorrection: 'M', border: 2 }

function decodePng(bytes: Buffer, padding = 0): QRCode {
  const png = PNG.sync.read(bytes)
  const width = png.width + padding * 2
  const height = png.height + padding * 2
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (let row = 0; row < png.height; row += 1) {
    data.set(
      png.data.subarray(row * png.width * 4, (row + 1) * png.width * 4),
      ((row + padding) * width + padding) * 4
    )
  }
  const decoded = jsQR(data, width, height, { inversionAttempts: 'dontInvert' })
  if (!decoded) throw new Error('Independent decoder could not read the generated PNG')
  return decoded
}

function formatCorrection(bytes: Buffer, version: number, border: number): number {
  const png = PNG.sync.read(bytes)
  const modules = version * 4 + 17
  const scale = png.width / (modules + border * 2)
  let format = 0
  for (let index = 0; index < 15; index += 1) {
    const row = index < 6 ? index : index < 8 ? index + 1 : modules - 15 + index
    const y = Math.floor((border + row + 0.5) * scale)
    const x = Math.floor((border + 8.5) * scale)
    if ((png.data[(y * png.width + x) * 4] ?? 255) < 128) format |= 1 << index
  }
  return ((format ^ 0x5412) >> 13) & 3
}

afterEach(() => vi.unstubAllGlobals())

describe('LocalQrEngine', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network is disabled')))
  })

  afterEach(() => {
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['Chinese and emoji', '你好，易码二维码 🌟'],
    ['URL', 'https://example.com/pay?amount=12.50&name=%E4%BD%A0%E5%A5%BD'],
    ['multiple lines and whitespace', '  第一行\n第二行\r\nhttps://example.com\n  ']
  ])('round-trips %s without a network request', async (_name, content) => {
    const bytes = await new LocalQrEngine().encode(content, defaults)
    const png = PNG.sync.read(bytes)
    expect(png.width).toBe(1024)
    expect(png.height).toBe(1024)
    expect(decodePng(bytes).data).toBe(content)
  })

  it('round-trips more than 900 ASCII characters with M correction', async () => {
    const content = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(20).slice(0, 1200)
    const bytes = await new LocalQrEngine().encode(content, defaults)
    expect(decodePng(bytes).data).toBe(content)
  })

  it('round-trips more than 900 common Chinese characters with explicitly chosen L correction', async () => {
    const content = '易码离线生成二维码中文内容'.repeat(100).slice(0, 950)
    expect(content.length).toBeGreaterThan(900)
    const bytes = await new LocalQrEngine().encode(content, { ...defaults, errorCorrection: 'L', border: 8 })
    expect(decodePng(bytes).data).toBe(content)
  })

  it('preserves default dimensions and border when encoding dense long content', async () => {
    const content = '易码离线生成二维码中文内容'.repeat(100).slice(0, 950)
    const png = PNG.sync.read(await new LocalQrEngine().encode(content, { ...defaults, errorCorrection: 'L' }))
    expect([png.width, png.height]).toEqual([1024, 1024])
    expect(png.data[0]).toBe(255)
  })

  it.each<ErrorCorrection>(['L', 'M', 'Q', 'H'])('writes %s correction into the QR format bits', async (level) => {
    const bytes = await new LocalQrEngine().encode('correction-level-check', {
      ...defaults,
      errorCorrection: level
    })
    const decoded = decodePng(bytes)
    const expected = { L: 1, M: 0, Q: 3, H: 2 }
    expect(decoded.data).toBe('correction-level-check')
    expect(formatCorrection(bytes, decoded.version, defaults.border)).toBe(expected[level])
  })

  it.each([0, 16])('preserves a %i-module border and an exact configured width', async (border) => {
    const bytes = await new LocalQrEngine().encode('border-check', { ...defaults, size: 512, border })
    const png = PNG.sync.read(bytes)
    expect(png.width).toBe(512)
    expect(png.height).toBe(512)
    // Add test-only white space so the independent locator can also inspect border=0 outputs.
    const decoded = decodePng(bytes, border === 0 ? 24 : 0)
    expect(decoded.data).toBe('border-check')
    const modules = decoded.version * 4 + 17
    const firstDarkPixel = Math.ceil((border * png.width) / (modules + border * 2))
    expect(png.data[(firstDarkPixel * png.width + firstDarkPixel) * 4]).toBe(0)
    if (firstDarkPixel > 0) {
      expect(png.data[((firstDarkPixel - 1) * png.width + firstDarkPixel) * 4]).toBe(255)
    }
  })

  it.each([128, 333, 1024, 4096])('produces an exact %i-pixel PNG', async (size) => {
    const png = PNG.sync.read(await new LocalQrEngine().encode('exact-size', { ...defaults, size }))
    expect([png.width, png.height]).toEqual([size, size])
  })

  it.each([{ size: 173, border: 0 }, { size: 185, border: 1 }])('avoids floating-point pixel loss with %j', async ({ size, border }) => {
    const bytes = await new LocalQrEngine().encode('exact-size', { ...defaults, size, border })
    const png = PNG.sync.read(bytes)
    expect([png.width, png.height]).toEqual([size, size])
    expect(decodePng(bytes, 24).data).toBe('exact-size')
  })

  it.each([
    { label: 'an integer scale', content: 'exact-size', size: 150, border: 2, margin: 12 },
    { label: 'the minimum matrix width at scale one', content: 'a'.repeat(1000), size: 129, border: 4, margin: 4 }
  ])('preserves boundary modules at $label', async ({ content, size, border, margin }) => {
    const png = PNG.sync.read(await new LocalQrEngine().encode(content, { ...defaults, size, border }))
    const pixel = (x: number, y: number): number | undefined => png.data[(y * png.width + x) * 4]
    expect([png.width, png.height]).toEqual([size, size])
    expect(pixel(margin, margin)).toBe(0)
    expect(pixel(margin - 1, margin)).toBe(255)
    expect(pixel(size - margin - 1, margin)).toBe(0)
    expect(pixel(size - margin, margin)).toBe(255)
    expect(pixel(margin, size - margin - 1)).toBe(0)
    expect(pixel(margin, size - margin)).toBe(255)
  })

  it('matches the independently decoded reference fixture after regenerating', async () => {
    const fixture = await readFile(path.join(import.meta.dirname, 'fixtures', 'qr-sample.png'))
    const reference = decodePng(fixture)
    expect(reference.data).toBe('wxp://f2f0lXAbpx9HDakSYhgZCO71HrkRlP7riDo7Qaf4ph0Bx2g')
    const bytes = await new LocalQrEngine().encode(reference.data, defaults)
    expect(decodePng(bytes).data).toBe(reference.data)
  })

  it('rejects capacity overflow without lowering correction or using the network', async () => {
    await expect(
      new LocalQrEngine().encode('汉'.repeat(901), defaults)
    ).rejects.toMatchObject({ code: 'CONTENT_TOO_LONG' })
    await expect(
      new LocalQrEngine().encode('1'.repeat(7090), defaults)
    ).rejects.toMatchObject({ code: 'CONTENT_TOO_LONG' })
  })

  it('rejects a width too small for the matrix instead of silently changing output dimensions', async () => {
    await expect(
      new LocalQrEngine().encode('a'.repeat(1200), { ...defaults, size: 128, border: 16 })
    ).rejects.toMatchObject({ code: 'QR_SIZE_TOO_SMALL' })
  })

  it('rejects empty input and makes unsupported local decode explicit', async () => {
    const engine = new LocalQrEngine()
    expect(engine.id).toBe('local')
    expect(engine.supportsDecode).toBe(false)
    await expect(engine.encode('  \n ', defaults)).rejects.toMatchObject({ code: 'EMPTY_CONTENT' })
    await expect(engine.decode({ bytes: new Uint8Array(), name: 'sample.png' })).rejects.toMatchObject({
      code: 'DECODE_UNSUPPORTED'
    })
    await expect(engine.health()).resolves.toMatchObject({ ok: true })
  })
})

describe('QR request validation', () => {
  it('accepts a complete settings snapshot without changing it', () => {
    expect(validateQrSettings({ ...defaults, engine: 'local' })).toEqual({ ...defaults, engine: 'local' })
  })

  it.each([
    { ...defaults, engine: 'unknown' },
    { ...defaults, engine: undefined },
    { ...defaults, size: '1024', engine: 'local' },
    { ...defaults, size: 127, engine: 'local' },
    { ...defaults, size: 1024.5, engine: 'local' },
    { ...defaults, size: Number.NaN, engine: 'local' },
    { ...defaults, border: 17, engine: 'local' },
    { ...defaults, border: 0.5, engine: 'local' },
    { ...defaults, errorCorrection: 'Z', engine: 'local' },
    null
  ])('rejects invalid snapshots rather than silently correcting them: %j', (options) => {
    expect(() => validateQrSettings(options)).toThrow()
  })
})

describe('CaoliaoQrEngine', () => {
  it('preserves content and wraps byte-based online decode', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(png))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: { contents: ['decoded'] } })))
    vi.stubGlobal('fetch', fetchMock)
    const engine = new CaoliaoQrEngine({ baseUrl: 'https://example.test/v1', apiKey: '', timeoutSeconds: 20 })
    expect(engine.supportsDecode).toBe(true)
    await engine.encode('  content\n ', defaults)
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.get('data')).toBe('  content\n ')
    await expect(engine.decode({ bytes: png, name: 'example.png' })).resolves.toEqual(['decoded'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
