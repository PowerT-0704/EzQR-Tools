import { readFile } from 'node:fs/promises'
import path from 'node:path'
import QRCode from 'qrcode'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalDecodeEngine } from '../src/main/services/local-decode-engine'
import { LocalQrEngine } from '../src/main/services/local-qr-engine'

const fixtureRoot = path.join(import.meta.dirname, 'fixtures')
const content = '  易码本地解析 🧪\nhttps://example.com/offline\n  '
const options = { size: 1024, errorCorrection: 'M' as const, border: 2 }

afterEach(() => vi.unstubAllGlobals())

describe('LocalDecodeEngine with the packaged reader WASM', () => {
  it.each(['1234567890'.repeat(300), '  \n  '])('decodes raw content without generation validation or truncation (%#)', async (text) => {
    const bytes = await QRCode.toBuffer(text, { width: 1024, margin: 8, errorCorrectionLevel: 'L' })
    expect(await new LocalDecodeEngine().decode({ bytes, name: 'decode-only.png' })).toEqual([text])
  })
  it.each([
    ['中文', '你好，易码二维码'],
    ['URL', 'https://example.com/?a=1&b=%E4%B8%AD'],
    ['multiline emoji and whitespace', '  \n第一行 🐉\r\nsecond line\n  '],
    ['long Chinese text', '汉'.repeat(950)]
  ])('decodes and regenerates %s without changing content or using fetch', async (_name, text) => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Offline'))
    vi.stubGlobal('fetch', fetchMock)
    const engine = new LocalQrEngine()
    const qr = { ...options, errorCorrection: 'L' as const }
    const first = await engine.encode(text, qr)
    expect(await engine.decode({ bytes: first, name: 'first.png' })).toEqual([text])
    const rebuilt = await engine.encode((await engine.decode({ bytes: first, name: 'first.png' }))[0]!, qr)
    expect(await engine.decode({ bytes: rebuilt, name: 'rebuilt.png' })).toEqual([text])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('matches the independent reference QR fixture', async () => {
    const bytes = await readFile(path.join(fixtureRoot, 'qr-sample.png'))
    expect(await new LocalDecodeEngine().decode({ bytes, name: 'reference.png' })).toEqual([
      'wxp://f2f0lXAbpx9HDakSYhgZCO71HrkRlP7riDo7Qaf4ph0Bx2g'
    ])
  })

  it.each(['base', 'low-resolution', 'rotate-90', 'rotate-180', 'rotate-270', 'inverted', 'offset'])
    ('decodes the fixed %s fixture', async (name) => {
      const bytes = await readFile(path.join(fixtureRoot, 'decode', `${name}.png`))
      expect(await new LocalDecodeEngine().decode({ bytes, name: `${name}.png` })).toEqual([content])
    })

  it('retains every QR including duplicate text, sorted by image position', async () => {
    const bytes = await readFile(path.join(fixtureRoot, 'decode', 'multiple.png'))
    expect(await new LocalDecodeEngine().decode({ bytes, name: 'multiple.png' })).toEqual([
      content, 'second QR', 'third QR', content
    ])
  })

  it('returns no results for a valid image without QR codes', async () => {
    const bytes = await readFile(path.join(fixtureRoot, 'decode', 'no-qr.png'))
    expect(await new LocalDecodeEngine().decode({ bytes, name: 'blank.png' })).toEqual([])
  })

  it('rejects damaged data and then permits a retry with valid data', async () => {
    const engine = new LocalDecodeEngine()
    await expect(engine.decode({ bytes: new Uint8Array(64), name: 'damaged.png' }))
      .rejects.toMatchObject({ code: 'INVALID_IMAGE' })
    const bytes = await readFile(path.join(fixtureRoot, 'decode', 'base.png'))
    expect(await engine.decode({ bytes, name: 'retry.png' })).toEqual([content])
  })
})
