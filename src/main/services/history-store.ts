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
  private pendingWrites: Promise<void> = Promise.resolve()

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

  private queueWrite<T>(write: () => Promise<T>): Promise<T> {
    const operation = this.pendingWrites.then(write)
    this.pendingWrites = operation.then(() => undefined, () => undefined)
    return operation
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
    return this.queueWrite(async () => {
      const records = [record, ...this.records].slice(0, this.limit)
      await writeTextAtomic(this.filePath, `${JSON.stringify(records, null, 2)}\n`)
      this.records = records.slice(0, this.limit)
      return structuredClone(record)
    })
  }

  async updateSavedPath(id: string, savedPath: string): Promise<void> {
    return this.queueWrite(async () => {
      if (!this.records.some((item) => item.id === id)) return
      const records = this.records.map((item) => item.id === id ? { ...item, savedPath } : item)
      await writeTextAtomic(this.filePath, `${JSON.stringify(records, null, 2)}\n`)
      this.records = records.slice(0, this.limit)
    })
  }

  async clear(): Promise<void> {
    return this.queueWrite(async () => {
      await writeTextAtomic(this.filePath, '[]\n')
      this.records = []
    })
  }

  async save(): Promise<void> {
    return this.queueWrite(() => writeTextAtomic(this.filePath, `${JSON.stringify(this.records, null, 2)}\n`))
  }
}

