import path from 'node:path'
import { access, mkdir, readdir } from 'node:fs/promises'
import type { AppConfig } from '../../shared/types'
import { writeBufferAtomic } from './atomic-file'

async function createDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true })
}

async function exists(candidate: string): Promise<boolean> {
  return access(candidate)
    .then(() => true)
    .catch(() => false)
}

export function customOutputDirectory(config: AppConfig): string | null {
  if (config.output.mode !== 'custom' || !config.output.directory.trim()) return null
  return path.resolve(config.output.directory.trim())
}

export async function buildRebuildPath(
  sourcePath: string,
  config: AppConfig
): Promise<string> {
  const source = path.resolve(sourcePath)
  const customDirectory = customOutputDirectory(config)
  const targetDirectory = customDirectory ?? path.dirname(source)
  await createDirectory(targetDirectory)
  const stem = path.parse(source).name
  if (stem.toLowerCase().endsWith('_rebuild')) {
    const root = stem.slice(0, -'_rebuild'.length) || stem
    let index = 1
    while (await exists(path.join(targetDirectory, `${root}_rebuild_${index}.png`))) {
      index += 1
    }
    return path.join(targetDirectory, `${root}_rebuild_${index}.png`)
  }
  return path.join(targetDirectory, `${stem}_rebuild.png`)
}

export async function savePng(target: string, bytes: Buffer): Promise<string> {
  const normalized = target.toLowerCase().endsWith('.png') ? target : `${target}.png`
  await writeBufferAtomic(normalized, bytes)
  return normalized
}

export async function defaultDownloadDirectory(
  config: AppConfig,
  lastSavedPath: string | null
): Promise<string> {
  const custom = customOutputDirectory(config)
  if (custom) {
    await createDirectory(custom)
    return custom
  }
  if (lastSavedPath) return path.dirname(lastSavedPath)
  return process.env.USERPROFILE || process.cwd()
}

export async function listPngFiles(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory))
      .filter((name) => name.toLowerCase().endsWith('.png'))
      .map((name) => path.join(directory, name))
  } catch {
    return []
  }
}

