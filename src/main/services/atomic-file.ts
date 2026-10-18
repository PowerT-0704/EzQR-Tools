import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function ensureDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true })
}

export async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function replaceFile(filePath: string, data: string | Buffer): Promise<void> {
  const directory = path.dirname(filePath)
  await ensureDirectory(directory)
  const temporary = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`)
  try {
    await writeFile(temporary, data)
    await rename(temporary, filePath)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}

export function writeTextAtomic(filePath: string, content: string): Promise<void> {
  return replaceFile(filePath, content)
}

export function writeBufferAtomic(filePath: string, content: Buffer): Promise<void> {
  return replaceFile(filePath, content)
}

export async function pathIsWritable(directory: string): Promise<boolean> {
  try {
    await ensureDirectory(directory)
    const probe = path.join(directory, `.write-test-${randomUUID()}`)
    await writeFile(probe, '')
    await rm(probe, { force: true })
    return true
  } catch {
    return false
  }
}

