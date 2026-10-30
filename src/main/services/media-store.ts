import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { MEDIA_SCHEME } from '../../shared/constants'

interface MediaEntry {
  data?: Buffer
  filePath?: string
  mime: string
  createdAt: number
}

type PreviewSlot = 'background' | 'generated' | 'rebuilt' | 'rebuild-source' | 'decode-source'

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
}

export class MediaStore {
  private readonly entries = new Map<string, MediaEntry>()
  private readonly maxEntries = 40
  private readonly previews = new Map<PreviewSlot, string>()

  addFile(filePath: string, preview?: PreviewSlot): string {
    const extension = path.extname(filePath).toLowerCase()
    const mime = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream'
    return this.add({ filePath, mime, createdAt: Date.now() }, preview)
  }

  addBuffer(data: Buffer, mime = 'image/png', preview?: PreviewSlot): string {
    return this.add({ data, mime, createdAt: Date.now() }, preview)
  }

  private add(entry: MediaEntry, preview?: PreviewSlot): string {
    const token = randomUUID()
    this.entries.set(token, entry)
    if (preview) this.previews.set(preview, token)
    while (this.entries.size > this.maxEntries) {
      const retained = new Set(this.previews.values())
      const oldest = [...this.entries.keys()].find((key) => !retained.has(key))
      if (!oldest) break
      this.entries.delete(oldest)
    }
    return `${MEDIA_SCHEME}://local/${token}`
  }

  get(token: string): MediaEntry | null {
    return this.entries.get(token) ?? null
  }

  async resolve(token: string): Promise<Response | null> {
    const entry = this.get(token)
    if (!entry) return null
    if (entry.data) {
      return new Response(new Uint8Array(entry.data), {
        headers: {
          'Content-Type': entry.mime,
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
    if (!entry.filePath) return null
    const info = await stat(entry.filePath).catch(() => null)
    if (!info?.isFile()) return null
    const { readFile } = await import('node:fs/promises')
    const data = await readFile(entry.filePath)
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': entry.mime,
        'Content-Length': String(data.byteLength),
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

