import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ConfigStore, sanitizeConfig } from '../src/main/services/config-store'

const temporaryDirectories: string[] = []

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('ConfigStore', () => {
  it('creates a valid default config', async () => {
    const programDir = await temporaryDirectory('qrtool-config-')
    const userDataDir = await temporaryDirectory('qrtool-user-')
    const store = await ConfigStore.create({ programDir, userDataDir })

    expect(store.get().schemaVersion).toBe(2)
    expect(store.get().appearance.palette).toBe('mistBlue')
    expect(store.get().qr.engine).toBe('local')
    expect(store.dataRoot).toBe(programDir)
    const saved = JSON.parse(
      await readFile(path.join(programDir, 'config', 'config.json'), 'utf8')
    ) as Record<string, unknown>
    expect(saved.schemaVersion).toBe(2)
  })

  it('sanitizes out-of-range and unknown settings', () => {
    const config = sanitizeConfig({
      api: { baseUrl: ' https://example.test/v1/ ', apiKey: ' secret ', timeoutSeconds: 999 },
      qr: { size: 99999, errorCorrection: 'Z', border: -2 },
      historyLimit: 0,
      appearance: {
        theme: 'dark',
        mood: 'ember',
        material: { backgroundBlur: 99, refraction: -4, highlight: 1.5 }
      },
      output: { mode: 'custom', directory: ' D:\\output ' }
    })

    expect(config.api.baseUrl).toBe('https://example.test/v1')
    expect(config.api.timeoutSeconds).toBe(120)
    expect(config.qr.size).toBe(4096)
    expect(config.qr.errorCorrection).toBe('M')
    expect(config.qr.border).toBe(0)
    expect(config.qr.engine).toBe('local')
    expect(config.historyLimit).toBe(1)
    expect(config.appearance.palette).toBe('sakuraPink')
    expect(config.appearance.material.backgroundBlur).toBe(30)
    expect(config.appearance.material.refraction).toBe(0)
    expect(config.appearance.material.highlight).toBe(1.5)
    expect(config.output.directory).toBe('D:\\output')
  })

  it('backs up a corrupt config and restores defaults', async () => {
    const programDir = await temporaryDirectory('qrtool-corrupt-')
    const userDataDir = await temporaryDirectory('qrtool-user-')
    await mkdir(path.join(programDir, 'config'), { recursive: true })
    await writeFile(path.join(programDir, 'config', 'config.json'), '{broken', 'utf8')

    const store = await ConfigStore.create({ programDir, userDataDir })
    expect(store.get().schemaVersion).toBe(2)
    expect(store.warnings.some((warning) => warning.includes('配置文件损坏'))).toBe(true)
  })

  it('migrates v1 dark appearance to a light palette without losing data', async () => {
    const programDir = await temporaryDirectory('qrtool-migrate-')
    const userDataDir = await temporaryDirectory('qrtool-user-')
    await mkdir(path.join(programDir, 'config'), { recursive: true })
    await writeFile(
      path.join(programDir, 'config', 'config.json'),
      JSON.stringify({
        schemaVersion: 1,
        api: {
          baseUrl: 'https://example.test/v1',
          apiKey: 'secret-key',
          timeoutSeconds: 30
        },
        qr: { size: 1024, errorCorrection: 'H', border: 4 },
        historyLimit: 80,
        appearance: {
          theme: 'dark',
          mood: 'aurora',
          backgroundImage: 'D:\\背景.png',
          material: {
            backgroundBlur: 17,
            refraction: 1.4,
            dispersion: 0.9,
            highlight: 1.1,
            frost: 0.5,
            elevation: 0.3,
            viscosity: 0.7
          }
        },
        output: { mode: 'custom', directory: 'D:\\输出' }
      }),
      'utf8'
    )

    const store = await ConfigStore.create({ programDir, userDataDir })
    expect(store.get().schemaVersion).toBe(2)
    expect(store.get().appearance.palette).toBe('mintGreen')
    expect(store.get().appearance.backgroundImage).toBe('D:\\背景.png')
    expect(store.get().appearance.material.backgroundBlur).toBe(17)
    expect(store.get().output).toEqual({ mode: 'custom', directory: 'D:\\输出' })
    expect(store.get().qr.engine).toBe('local')

    const saved = JSON.parse(
      await readFile(path.join(programDir, 'config', 'config.json'), 'utf8')
    ) as { schemaVersion: number; appearance: Record<string, unknown> }
    expect(saved.schemaVersion).toBe(2)
    expect(saved.appearance.palette).toBe('mintGreen')
    expect(saved.appearance).not.toHaveProperty('theme')
    expect(saved.appearance).not.toHaveProperty('mood')
  })

  it('defaults old v2 settings to local without rewriting their file', async () => {
    const programDir = await temporaryDirectory('qrtool-v2-local-')
    const userDataDir = await temporaryDirectory('qrtool-user-')
    await mkdir(path.join(programDir, 'config'), { recursive: true })
    const configPath = path.join(programDir, 'config', 'config.json')
    const original = JSON.stringify({
      schemaVersion: 2,
      qr: { size: 768, errorCorrection: 'Q', border: 8 },
      output: { mode: 'custom', directory: 'D:\\输出' }
    })
    await writeFile(configPath, original)
    const store = await ConfigStore.create({ programDir, userDataDir })
    expect(store.get().qr).toEqual({ engine: 'local', size: 768, errorCorrection: 'Q', border: 8 })
    expect(await readFile(configPath, 'utf8')).toBe(original)
  })

  it('persists engine choice and normalizes fractional QR settings', async () => {
    const programDir = await temporaryDirectory('qrtool-engine-')
    const userDataDir = await temporaryDirectory('qrtool-user-')
    const store = await ConfigStore.create({ programDir, userDataDir })
    await store.update((config) => {
      config.qr = { engine: 'caoliao', size: 512.8, errorCorrection: 'H', border: 3.2 }
    })
    const reloaded = await ConfigStore.create({ programDir, userDataDir })
    expect(reloaded.get().qr).toEqual({ engine: 'caoliao', size: 513, errorCorrection: 'H', border: 3 })
    expect(sanitizeConfig({ qr: { engine: 'unknown' } }).qr.engine).toBe('local')
  })

  it('writes and restores a data directory pointer', async () => {
    const programDir = await temporaryDirectory('qrtool-pointer-')
    const userDataDir = await temporaryDirectory('qrtool-user-')
    const dataDir = await temporaryDirectory('qrtool-data-')
    const store = await ConfigStore.create({ programDir, userDataDir })

    const message = await store.setDataRoot(dataDir)
    expect(message).toContain(dataDir)
    expect((await readFile(path.join(programDir, 'data_dir.txt'), 'utf8')).trim()).toBe(dataDir)

    const restored = await store.resetDataRoot()
    expect(restored).toContain('恢复为程序目录')
    await expect(readFile(path.join(programDir, 'data_dir.txt'), 'utf8')).rejects.toThrow()
  })
})

