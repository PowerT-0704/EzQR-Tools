import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PNG } from 'pngjs'
import { expect, it } from 'vitest'
import { validateNormalizedPng, validateQrSource } from '../src/main/services/image-input'
import { validateImageDimensions } from '../src/shared/image-limits'
import { MAX_NORMALIZED_PNG_BYTES, MAX_QR_SOURCE_BYTES } from '../src/shared/constants'

it('validates PNG headers and pixel limits before calling WASM', () => {
  const bytes = PNG.sync.write(new PNG({ width: 16, height: 16 }))
  expect(() => validateNormalizedPng(bytes)).not.toThrow()
  for (const invalid of [null, [], new Uint8Array(), Buffer.alloc(40)]) {
    expect(() => validateNormalizedPng(invalid)).toThrow(/无效|损坏|PNG/)
  }
  for (const [width, height] of [[8193, 1], [4097, 4096], [0, 1]]) {
    const fake = Buffer.from(bytes)
    fake.writeUInt32BE(width!, 16)
    fake.writeUInt32BE(height!, 20)
    expect(() => validateNormalizedPng(fake)).toThrow(/过大|尺寸无效/)
  }
  expect(() => validateNormalizedPng(new Uint8Array(MAX_NORMALIZED_PNG_BYTES + 1))).toThrow(/64 MiB/)
  expect(() => validateImageDimensions(8192, 2048)).not.toThrow()
  expect(() => validateImageDimensions(1.5, 2)).toThrow(/尺寸无效/)
})

it('rejects source files over 32 MiB and directories', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ezqr-image-input-'))
  try {
    const source = path.join(root, 'source.png')
    await writeFile(source, '')
    await truncate(source, MAX_QR_SOURCE_BYTES)
    await expect(validateQrSource(source)).resolves.toBeUndefined()
    await truncate(source, MAX_QR_SOURCE_BYTES + 1)
    await expect(validateQrSource(source)).rejects.toMatchObject({ code: 'IMAGE_TOO_LARGE' })
    await expect(validateQrSource(root)).rejects.toMatchObject({ code: 'IMAGE_READ' })
  } finally {
    if (!root.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(root).startsWith('ezqr-image-input-')) {
      throw new Error('Refusing to remove a non-temporary path')
    }
    await rm(root, { recursive: true, force: true })
  }
})
