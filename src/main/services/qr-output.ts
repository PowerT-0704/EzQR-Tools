import path from 'node:path'
import { access, mkdir, readdir } from 'node:fs/promises'
import { QR_FORMATS } from '../../shared/qr-formats'
import type { AppConfig, QrExportFormat } from '../../shared/types'
import { writeBufferAtomic } from './atomic-file'
import { AppError } from './errors'

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
  config: AppConfig,
  format: QrExportFormat = 'png'
): Promise<string> {
  const source = path.resolve(sourcePath)
  const customDirectory = customOutputDirectory(config)
  const targetDirectory = customDirectory ?? path.dirname(source)
  await createDirectory(targetDirectory)
  const stem = path.parse(source).name
  if (format !== 'png') {
    const suffix = format === 'transparent-png' ? '_rebuild_transparent.png' : '_rebuild.svg'
    const { name, ext } = path.parse(stem + suffix)
    let index = 0
    let target = path.join(targetDirectory, name + ext)
    while (await exists(target)) {
      index += 1
      target = path.join(targetDirectory, name + '_' + index + ext)
    }
    return target
  }
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

export async function saveQrFile(
  target: string,
  bytes: Buffer,
  format: QrExportFormat,
  sourcePath?: string
): Promise<string> {
  const expected = '.' + QR_FORMATS[format].extension
  const extension = path.extname(target)
  if (extension && extension.toLowerCase() !== expected) {
    throw new AppError('INVALID_FORMAT', '文件扩展名应为 ' + expected + '，请修改文件名后重试')
  }
  const normalized = extension ? target : target + expected
  if (sourcePath && path.resolve(normalized).toLowerCase() === path.resolve(sourcePath).toLowerCase()) {
    throw new AppError('SAVE_FAILED', '请选择不同的文件名，保留原始图片')
  }
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

