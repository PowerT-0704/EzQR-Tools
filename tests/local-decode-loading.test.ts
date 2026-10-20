import * as fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof fs>()
  return { ...original, readFile: vi.fn(original.readFile) }
})

beforeEach(() => vi.resetModules())
afterEach(() => {
  vi.mocked(fs.readFile).mockRestore()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each(['missing', 'corrupted', 'initialization failure'])('retries after a %s WASM file without any CDN fallback', async (failure) => {
  const bytes = await fs.readFile(path.join(import.meta.dirname, 'fixtures', 'decode', 'base.png'))
  const fetchMock = vi.fn().mockRejectedValue(new Error('Offline'))
  vi.stubGlobal('fetch', fetchMock)
  if (failure === 'missing') vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('ENOENT'))
  else if (failure === 'corrupted') vi.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from('invalid WASM'))
  else {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(WebAssembly, 'instantiate').mockRejectedValueOnce(new Error('Instantiation failed'))
  }
  const { LocalDecodeEngine } = await import('../src/main/services/local-decode-engine')
  const engine = new LocalDecodeEngine()
  await expect(engine.decode({ bytes, name: 'source.png' }))
    .rejects.toMatchObject({ code: 'LOCAL_DECODE_UNAVAILABLE' })
  await expect(engine.decode({ bytes, name: 'same-source.png' }))
    .resolves.toEqual(['  易码本地解析 🧪\nhttps://example.com/offline\n  '])
  const readsAfterRetry = vi.mocked(fs.readFile).mock.calls.length
  await engine.decode({ bytes, name: 'cached-reader.png' })
  expect(vi.mocked(fs.readFile).mock.calls).toHaveLength(readsAfterRetry)
  expect(fetchMock).not.toHaveBeenCalled()
})
