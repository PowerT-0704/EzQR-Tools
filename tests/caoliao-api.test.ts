import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { CaoliaoApi } from '../src/main/services/caoliao-api'

const temporaryDirectories: string[] = []

async function sampleImage(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qrtool-api-'))
  temporaryDirectories.push(directory)
  const file = path.join(directory, 'sample.png')
  await writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  return file
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

const config = {
  baseUrl: 'https://example.test/v1',
  apiKey: '',
  timeoutSeconds: 20
}

describe('CaoliaoApi', () => {
  it('decodes QR contents from the API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 0, data: { contents: ['hello', 'world'] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    )
    const api = new CaoliaoApi(config)
    await expect(api.decodeImage(await sampleImage())).resolves.toEqual(['hello', 'world'])
  })

  it('maps unauthorized responses to a useful message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    const api = new CaoliaoApi(config)
    await expect(api.decodeImage(await sampleImage())).rejects.toThrow('接口密钥无效或权限不足')
  })

  it('rejects invalid JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 200 })))
    const api = new CaoliaoApi(config)
    await expect(api.decodeImage(await sampleImage())).rejects.toThrow('服务器返回内容无法解析')
  })

  it('generates a PNG and sends QR settings', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])
    const fetchMock = vi.fn().mockResolvedValue(new Response(png, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const api = new CaoliaoApi(config)
    const result = await api.generateQr('hello', {
      size: 1024,
      errorCorrection: 'H',
      border: 4
    })
    expect(result.subarray(0, 4).toString('latin1')).toBe('PNG')
    const calledUrl = String(fetchMock.mock.calls[0]?.[0])
    expect(calledUrl).toContain('size=1024x1024')
    expect(calledUrl).toContain('error_correction=H')
  })

  it('rejects empty content before sending a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const api = new CaoliaoApi(config)
    await expect(
      api.generateQr('   ', { size: 1024, errorCorrection: 'M', border: 2 })
    ).rejects.toThrow('二维码内容不能为空')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

