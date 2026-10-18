import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { HistoryRecord } from '../../shared/types'
import { readTextIfExists, writeTextAtomic } from './atomic-file'

function formatLocalTime(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  ].join(' ')
}

export class HistoryStore {
  private readonly filePath: string
  private limit: number
  private records: HistoryRecord[] = []

  constructor(configDir: string, limit: number) {
    this.filePath = path.join(configDir, 'history.json')
    this.limit = Math.max(1, Math.floor(limit))
  }

  async load(): Promise<void> {
    const raw = await readTextIfExists(this.filePath)
    if (!raw) {
      this.records = []
      return
    }
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('history is not an array')
      this.records = parsed
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map<HistoryRecord>((item) => ({
          id: typeof item.id === 'string' ? item.id : randomUUID(),
          time: typeof item.time === 'string' ? item.time : formatLocalTime(),
          type: item.type === 'rebuild' ? 'rebuild' : 'generate',
          content: typeof item.content === 'string' ? item.content : '',
          savedPath: typeof item.savedPath === 'string' ? item.savedPath : ''
        }))
        .slice(0, this.limit)
    } catch {
      this.records = []
    }
  }

  get(): HistoryRecord[] {
    return structuredClone(this.records)
  }

  setLimit(limit: number): void {
    this.limit = Math.max(1, Math.floor(limit))
    this.records = this.records.slice(0, this.limit)
  }

  async add(
    type: HistoryRecord['type'],
    content: string,
    savedPath = ''
  ): Promise<HistoryRecord> {
    const record: HistoryRecord = {
      id: randomUUID(),
      time: formatLocalTime(),
      type,
      content,
      savedPath
    }
    this.records.unshift(record)
    this.records = this.records.slice(0, this.limit)
    await this.save()
    return structuredClone(record)
  }

  async updateSavedPath(id: string, savedPath: string): Promise<void> {
    const record = this.records.find((item) => item.id === id)
    if (!record) return
    record.savedPath = savedPath
    await this.save()
  }

  async clear(): Promise<void> {
    this.records = []
    await this.save()
  }

  async save(): Promise<void> {
    await writeTextAtomic(this.filePath, `${JSON.stringify(this.records, null, 2)}\n`)
  }
}

