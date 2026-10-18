import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createDefaultConfig } from '../src/main/services/config-store'
import { buildRebuildPath, savePng } from '../src/main/services/qr-output'

const directories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qrtool-output-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('QR output paths', () => {
  it('follows the source directory by default', async () => {
    const directory = await temporaryDirectory()
    const source = path.join(directory, 'sample.png')
    const target = await buildRebuildPath(source, createDefaultConfig())
    expect(target).toBe(path.join(directory, 'sample_rebuild.png'))
  })

  it('uses the custom output directory', async () => {
    const sourceDirectory = await temporaryDirectory()
    const outputDirectory = await temporaryDirectory()
    const config = createDefaultConfig()
    config.output = { mode: 'custom', directory: outputDirectory }
    const target = await buildRebuildPath(path.join(sourceDirectory, 'sample.png'), config)
    expect(target).toBe(path.join(outputDirectory, 'sample_rebuild.png'))
  })

  it('numbers rebuilds of existing rebuild files without overwriting', async () => {
    const directory = await temporaryDirectory()
    const config = createDefaultConfig()
    await writeFile(path.join(directory, 'sample_rebuild_1.png'), 'existing')
    const target = await buildRebuildPath(path.join(directory, 'sample_rebuild.png'), config)
    expect(target).toBe(path.join(directory, 'sample_rebuild_2.png'))
  })

  it('adds a PNG suffix and writes binary data', async () => {
    const directory = await temporaryDirectory()
    const target = await savePng(path.join(directory, 'QRCode'), Buffer.from([1, 2, 3]))
    expect(target.endsWith('.png')).toBe(true)
  })
})

